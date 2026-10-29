-- Recordatorios: prueba real y diagnóstico desde la app.
--
-- reminders.test_at       se pidió un aviso de prueba (se manda aunque no sea la hora)
-- reminders.last_attempt  último intento de enviar el aviso a esa persona
-- reminders.last_error    por qué falló ese intento (null = llegó al servicio del móvil)
-- pending_reminders()     igual que antes y además los avisos de prueba (is_test)
-- mark_reminders_sent()   marca enviados; una prueba antes de la hora no gasta el aviso del día
-- log_reminder_attempts() la app apunta el resultado de cada envío
-- request_test_reminder() pide la prueba y llama a la app al momento (sin esperar a pg_cron)
-- reminder_status()       todo lo necesario para ver qué falla, desde Ajustes
-- Se puede ejecutar más de una vez.

alter table public.reminders add column if not exists test_at timestamptz;
alter table public.reminders add column if not exists last_attempt timestamptz;
alter table public.reminders add column if not exists last_error text;

-- Cambia lo que devuelve (is_test), así que hay que borrarla antes.
drop function if exists public.pending_reminders(text);
create function public.pending_reminders(p_secret text)
returns table (user_id uuid, endpoint text, p256dh text, auth text, routine_day smallint, vapid_private text, is_test boolean)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'reminder_secret') then
    raise exception 'forbidden';
  end if;

  return query
  with local as (
    select r.*, (now() at time zone r.timezone) as local_now
    from public.reminders r
    where r.enabled
  ), info as (
    select l.user_id, l.local_now, l.local_now::date as local_date,
           extract(isodow from l.local_now)::smallint as dow,
           l.mode, l.weekdays, l.skip_if_trained, l.time_of_day, l.last_sent, l.test_at,
           p.id as program_id,
           (select min(key::smallint) from jsonb_each_text(coalesce(p.schedule, '{}'::jsonb)) s(key, value)
             where s.value::smallint = extract(isodow from l.local_now)
               and exists (select 1 from public.exercises e where e.program_id = p.id and e.day = s.key::smallint)) as today_day
    from local l
    left join public.programs p on p.user_id = l.user_id
  ), due as (
    select i.user_id, i.today_day, coalesce(i.test_at > now() - interval '15 minutes', false) as is_test
    from info i
    where coalesce(i.test_at > now() - interval '15 minutes', false)
       or (i.local_now >= i.local_date + i.time_of_day
      and i.local_now < i.local_date + i.time_of_day + interval '2 hours'
      and (i.last_sent is null or i.last_sent < i.local_date)
      and case i.mode
            when 'daily' then true
            when 'training' then i.today_day is not null
            else i.dow = any (i.weekdays)
          end
      and not (i.skip_if_trained and exists (
            select 1 from public.set_logs sl where sl.program_id = i.program_id and sl.logged_on = i.local_date)))
  )
  select d.user_id, s.endpoint, s.p256dh, s.auth, d.today_day, (select value from private.settings where key = 'vapid_private'), d.is_test
  from due d
  join public.push_subscriptions s on s.user_id = d.user_id;
end;
$$;

-- Marca como enviados los avisos de estos usuarios. Una prueba antes de la hora del aviso
-- no cuenta como el aviso del día (si no, ese día ya no llegaría el de verdad).
create or replace function public.mark_reminders_sent(p_secret text, p_users uuid[])
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'reminder_secret') then
    raise exception 'forbidden';
  end if;
  update public.reminders r
     set test_at = null,
         last_sent = case when (now() at time zone r.timezone) >= (now() at time zone r.timezone)::date + r.time_of_day
                          then (now() at time zone r.timezone)::date else r.last_sent end
   where r.user_id = any (p_users);
end;
$$;

-- Resultado de cada envío: [{ "user_id": "...", "error": null | "texto" }].
create or replace function public.log_reminder_attempts(p_secret text, p_log jsonb)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'reminder_secret') then
    raise exception 'forbidden';
  end if;
  update public.reminders r
     set last_attempt = now(), last_error = left(x.error, 300)
    from jsonb_to_recordset(coalesce(p_log, '[]'::jsonb)) as x(user_id uuid, error text)
   where r.user_id = x.user_id;
end;
$$;

-- Pide un aviso de prueba para quien la llama y avisa a la app enseguida. Si la llamada
-- inmediata no sale, la siguiente vuelta de pg_cron (cada 5 minutos) lo manda igual.
create or replace function public.request_test_reminder()
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sin sesión'; end if;
  update public.reminders set test_at = now() where user_id = v_user and enabled;
  if not found then raise exception 'Activa y guarda antes el recordatorio'; end if;
  begin
    perform net.http_post(
      url := 'https://app-gym-swart.vercel.app/api/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select value from private.settings where key = 'reminder_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    return true;
  exception when others then
    return false;
  end;
end;
$$;

-- Estado del recordatorio de quien la llama: su configuración, sus dispositivos y si el
-- servidor de avisos (pg_cron → app) funciona. No devuelve ningún secreto.
create or replace function public.reminder_status(p_endpoint text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v jsonb;
  v_cron jsonb := null;
  v_http jsonb := null;
begin
  if v_user is null then raise exception 'Sin sesión'; end if;

  select jsonb_build_object(
           'enabled', r.enabled, 'time', to_char(r.time_of_day, 'HH24:MI'), 'timezone', r.timezone,
           'last_sent', r.last_sent, 'last_attempt', r.last_attempt, 'last_error', r.last_error, 'test_at', r.test_at)
    into v from public.reminders r where r.user_id = v_user;

  begin
    select jsonb_build_object('active', j.active, 'last_run', d.start_time, 'last_status', d.status, 'last_message', left(d.return_message, 200))
      into v_cron
      from cron.job j
      left join lateral (select * from cron.job_run_details x where x.jobid = j.jobid order by x.start_time desc limit 1) d on true
     where j.jobname = 'rutina-recordatorios';
  exception when others then v_cron := null;
  end;

  begin
    select jsonb_build_object('at', h.created, 'status', h.status_code, 'timed_out', h.timed_out,
                              'error', left(h.error_msg, 200), 'body', left(h.content, 200))
      into v_http
      from net._http_response h
     order by h.created desc limit 1;
  exception when others then v_http := null;
  end;

  return coalesce(v, '{}'::jsonb) || jsonb_build_object(
    'devices', (select count(*) from public.push_subscriptions s where s.user_id = v_user),
    'this_device', p_endpoint is not null and exists (select 1 from public.push_subscriptions s where s.user_id = v_user and s.endpoint = p_endpoint),
    'keys_ok', (select count(*) = 2 from private.settings where key in ('reminder_secret', 'vapid_private') and coalesce(value, '') <> ''),
    'cron', v_cron,
    'http', v_http
  );
end;
$$;

revoke all on function public.pending_reminders(text), public.mark_reminders_sent(text, uuid[]), public.log_reminder_attempts(text, jsonb) from public;
grant execute on function public.pending_reminders(text), public.mark_reminders_sent(text, uuid[]), public.log_reminder_attempts(text, jsonb) to anon, authenticated;
revoke all on function public.request_test_reminder(), public.reminder_status(text) from public, anon;
grant execute on function public.request_test_reminder(), public.reminder_status(text) to authenticated;
