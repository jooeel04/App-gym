-- Recordatorio diario para entrenar (notificaciones push con la app cerrada).
--
-- push_subscriptions  dispositivos de cada usuario que aceptan notificaciones
-- reminders           1 por usuario: hora, días y opciones del recordatorio
-- private.settings    secretos del envío (no accesibles desde la API)
--
-- Cada 5 minutos pg_cron llama a /api/reminders (Vercel) con el secreto. Esa ruta
-- pide a due_reminders() a quién le toca el aviso (comprueba el secreto) y manda
-- las notificaciones. La clave privada VAPID se guarda aparte, a mano (no va en
-- este archivo): insert into private.settings values ('vapid_private', '...').

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Secretos
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.settings (
  key   text primary key,
  value text not null
);

insert into private.settings (key, value)
values ('reminder_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  endpoint   text primary key check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- mode: 'daily' todos los días · 'training' días con rutina en el calendario ·
-- 'custom' los días de `weekdays` (1 = lunes … 7 = domingo).
create table public.reminders (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled         boolean not null default true,
  time_of_day     time not null default '18:00',
  mode            text not null default 'training' check (mode in ('daily', 'training', 'custom')),
  weekdays        smallint[] not null default '{1,2,3,4,5}' check (weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]),
  skip_if_trained boolean not null default true,
  timezone        text not null default 'Europe/Madrid' check (char_length(timezone) <= 64),
  last_sent       date,
  updated_at      timestamptz not null default now()
);

-- Zona horaria válida: si no, la consulta del envío fallaría para todos.
create or replace function public.check_reminder_timezone()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $
begin
  perform now() at time zone new.timezone;
  new.updated_at := now();
  return new;
exception when others then
  raise exception 'Zona horaria no válida: %', new.timezone;
end;
$;

create trigger reminders_check_timezone before insert or update on public.reminders
  for each row execute function public.check_reminder_timezone();

alter table public.push_subscriptions enable row level security;
alter table public.reminders enable row level security;

create policy "push_subscriptions: propias" on public.push_subscriptions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reminders: propio" on public.reminders
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- A quién le toca el aviso ahora (y lo marca como enviado hoy)
-- ---------------------------------------------------------------------------
-- Toca si: está activado, hoy es uno de sus días (según el modo), ya pasó su hora
-- (con margen de 2 horas por si el envío se retrasa), hoy no se le ha avisado y,
-- si lo pidió, hoy todavía no ha anotado ninguna serie. `routine_day` es el día de
-- rutina (1-5) que tiene asignado hoy, para poner su nombre en el aviso.

create or replace function public.due_reminders(p_secret text)
returns table (endpoint text, p256dh text, auth text, routine_day smallint, vapid_private text)
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
    select i.user_id, i.local_date, i.today_day
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
  ), marked as (
    update public.reminders r set last_sent = d.local_date
    from due d where r.user_id = d.user_id
    returning r.user_id, d.today_day
  )
  select s.endpoint, s.p256dh, s.auth, m.today_day, (select value from private.settings where key = 'vapid_private')
  from public.push_subscriptions s
  join marked m on m.user_id = s.user_id;
end;
$$;

-- Borra un dispositivo que ya no acepta avisos (el servicio de push respondió 404/410).
create or replace function public.drop_push_subscription(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'reminder_secret') then
    raise exception 'forbidden';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke all on function public.due_reminders(text) from public;
revoke all on function public.drop_push_subscription(text, text) from public;
grant execute on function public.due_reminders(text) to anon, authenticated;
grant execute on function public.drop_push_subscription(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cada 5 minutos: avisar a quien le toque
-- ---------------------------------------------------------------------------

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
    body := '{}'::jsonb
  );
  $$
);
