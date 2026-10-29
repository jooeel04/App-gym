-- Recordatorios más fiables.
--
-- Antes, due_reminders() marcaba el aviso como enviado ANTES de mandarlo: si el envío
-- fallaba (servidor lento, error del servicio de notificaciones…), ese día ya no se
-- reintentaba. Ahora:
--   · pending_reminders() solo dice a quién le toca (sin marcar nada).
--   · mark_reminders_sent() marca como enviados los que de verdad se mandaron.
-- Mientras no se marque, se reintenta en cada vuelta (cada 5 minutos) durante las 2 horas
-- siguientes a la hora elegida. due_reminders() se queda como estaba (por compatibilidad).
-- Además, la llamada de pg_cron a /api/reminders espera hasta 30 s (antes 5 s).
-- Se puede ejecutar más de una vez.

create or replace function public.pending_reminders(p_secret text)
returns table (user_id uuid, endpoint text, p256dh text, auth text, routine_day smallint, vapid_private text)
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
           l.mode, l.weekdays, l.skip_if_trained, l.time_of_day, l.last_sent,
           p.id as program_id,
           (select min(key::smallint) from jsonb_each_text(coalesce(p.schedule, '{}'::jsonb)) s(key, value)
             where s.value::smallint = extract(isodow from l.local_now)
               and exists (select 1 from public.exercises e where e.program_id = p.id and e.day = s.key::smallint)) as today_day
    from local l
    left join public.programs p on p.user_id = l.user_id
  ), due as (
    select i.user_id, i.today_day
    from info i
    where i.local_now >= i.local_date + i.time_of_day
      and i.local_now < i.local_date + i.time_of_day + interval '2 hours'
      and (i.last_sent is null or i.last_sent < i.local_date)
      and case i.mode
            when 'daily' then true
            when 'training' then i.today_day is not null
            else i.dow = any (i.weekdays)
          end
      and not (i.skip_if_trained and exists (
            select 1 from public.set_logs sl where sl.program_id = i.program_id and sl.logged_on = i.local_date))
  )
  select d.user_id, s.endpoint, s.p256dh, s.auth, d.today_day, (select value from private.settings where key = 'vapid_private')
  from due d
  join public.push_subscriptions s on s.user_id = d.user_id;
end;
$$;

-- Marca como enviado hoy (en la hora local de cada uno) el aviso de estos usuarios.
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
     set last_sent = (now() at time zone r.timezone)::date
   where r.user_id = any (p_users);
end;
$$;

revoke all on function public.pending_reminders(text) from public;
revoke all on function public.mark_reminders_sent(text, uuid[]) from public;
grant execute on function public.pending_reminders(text) to anon, authenticated;
grant execute on function public.mark_reminders_sent(text, uuid[]) to anon, authenticated;

-- La misma tarea cada 5 minutos, ahora esperando hasta 30 s la respuesta de Vercel
-- (al arrancar en frío puede tardar más de los 5 s que espera pg_net por defecto).
select cron.schedule(
  'rutina-recordatorios',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://app-gym-swart.vercel.app/api/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from private.settings where key = 'reminder_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
