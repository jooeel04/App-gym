-- Días de rutina propios, un día en varios días de la semana y el máximo con sus series
-- (specs rutina R1–R5, social R1–R2, datos R3). Se puede ejecutar más de una vez.
--
-- 1. Días de rutina del 1 al 7 (antes 1–5) y sus nombres en programs.day_names
--    (null = los 5 de siempre: Torso, Pierna, Empujes, Tirones, Hombros y brazos).
-- 2. programs.schedule: cada día de rutina con su lista de días de la semana
--    ({"1": [1, 4]} = lunes y jueves). El formato antiguo ({"1": 1}) sigue valiendo.
-- 3. remove_routine_day(): borra un día con todo lo suyo en una sola transacción.
-- 4. replace_program(): copia también los nombres de los días (p_day_names).
-- 5. pending_reminders(): entiende los dos formatos de schedule y da el nombre del día.
-- 6. group_exercise_records(): la marca es el día de más peso con todas sus series; a
--    igual peso, el de más repeticiones en total.

-- ---------------------------------------------------------------------------
-- 1. Días 1–7 y sus nombres
-- ---------------------------------------------------------------------------

alter table public.exercises drop constraint if exists exercises_day_check;
alter table public.exercises add constraint exercises_day_check check (day between 1 and 7);
alter table public.set_logs drop constraint if exists set_logs_day_check;
alter table public.set_logs add constraint set_logs_day_check check (day between 1 and 7);
alter table public.completed_days drop constraint if exists completed_days_day_check;
alter table public.completed_days add constraint completed_days_day_check check (day between 1 and 7);

alter table public.programs add column if not exists day_names jsonb;
alter table public.programs drop constraint if exists programs_day_names_check;
alter table public.programs add constraint programs_day_names_check
  check (day_names is null or (jsonb_typeof(day_names) = 'object' and pg_column_size(day_names) <= 2048));

-- ---------------------------------------------------------------------------
-- 2. Calendario con listas (lo que ya hay se deja: la app y el recordatorio leen ambos)
-- ---------------------------------------------------------------------------

alter table public.programs alter column schedule set default '{"1": [1], "2": [2], "3": [3], "4": [4], "5": [5]}'::jsonb;

-- ---------------------------------------------------------------------------
-- 3. Borrar un día de rutina (una transacción). security invoker: RLS deja tocar solo
--    el programa propio.
-- ---------------------------------------------------------------------------

create or replace function public.remove_routine_day(p_program_id uuid, p_day smallint, p_day_names jsonb, p_schedule jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Las series de sus ejercicios se borran en cascada.
  delete from public.exercises where program_id = p_program_id and day = p_day;
  delete from public.set_logs where program_id = p_program_id and day = p_day;
  delete from public.completed_days where program_id = p_program_id and day = p_day;
  update public.programs set day_names = p_day_names, schedule = p_schedule where id = p_program_id;
end;
$$;

revoke execute on function public.remove_routine_day(uuid, smallint, jsonb, jsonb) from public, anon;
grant execute on function public.remove_routine_day(uuid, smallint, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. replace_program con los nombres de los días
-- ---------------------------------------------------------------------------

drop function if exists public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb);
drop function if exists public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb);

create function public.replace_program(
  p_weeks_count integer,
  p_exercises   jsonb,
  p_logs        jsonb,
  p_completed   jsonb,
  p_schedule    jsonb default null,
  p_start_date  date default null,
  p_body        jsonb default null,
  p_day_names   jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_program uuid;
begin
  if v_user is null and current_user <> 'service_role' then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select id into v_program from public.programs where user_id is not distinct from v_user;
  if v_program is null then
    insert into public.programs (user_id, weeks_count) values (v_user, p_weeks_count)
    returning id into v_program;
  end if;

  update public.programs
  set weeks_count = p_weeks_count,
      schedule    = coalesce(p_schedule, schedule),
      start_date  = p_start_date,
      day_names   = p_day_names
  where id = v_program;

  -- Al borrar los ejercicios se borran en cascada sus series.
  delete from public.exercises where program_id = v_program;
  delete from public.completed_days where program_id = v_program;
  delete from public.body_metrics where program_id = v_program;

  insert into public.exercises
    (program_id, local_id, day, position, group_name, name, note, prescription, sets, target, optional_last, custom, superset)
  select v_program,
         (e ->> 'id')::integer,
         (e ->> 'day')::smallint,
         ord::integer,
         coalesce(e ->> 'group', ''),
         e ->> 'name',
         coalesce(e ->> 'note', ''),
         coalesce(e ->> 'prescription', ''),
         (e ->> 'sets')::smallint,
         coalesce(e ->> 'target', 'Sin rango'),
         coalesce((e ->> 'optionalLast')::boolean, false),
         coalesce((e ->> 'custom')::boolean, false),
         coalesce((e ->> 'superset')::boolean, false)
  from jsonb_array_elements(p_exercises) with ordinality as t(e, ord);

  insert into public.set_logs (program_id, week, day, round, exercise_local_id, set_number, weight, reps, note, logged_on)
  select v_program,
         (l ->> 'week')::integer,
         (l ->> 'day')::smallint,
         coalesce((l ->> 'round')::smallint, 1),
         (l ->> 'exercise')::integer,
         (l ->> 'set')::smallint,
         (l ->> 'weight')::numeric,
         (l ->> 'reps')::integer,
         nullif(l ->> 'note', ''),
         (l ->> 'date')::date
  from jsonb_array_elements(p_logs) as t(l)
  where exists (
    select 1 from public.exercises x
    where x.program_id = v_program and x.local_id = (l ->> 'exercise')::integer
  );

  insert into public.completed_days (program_id, week, day, round)
  select v_program, (c ->> 'week')::integer, (c ->> 'day')::smallint, coalesce((c ->> 'round')::smallint, 1)
  from jsonb_array_elements(p_completed) as t(c)
  on conflict do nothing;

  insert into public.body_metrics (program_id, date, weight, waist, chest, arm, thigh, hip)
  select v_program, (b ->> 'date')::date,
         (b ->> 'weight')::numeric, (b ->> 'waist')::numeric, (b ->> 'chest')::numeric,
         (b ->> 'arm')::numeric, (b ->> 'thigh')::numeric, (b ->> 'hip')::numeric
  from jsonb_array_elements(coalesce(p_body, '[]'::jsonb)) as t(b)
  on conflict do nothing;

  return v_program;
end;
$$;

revoke execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb) from public, anon;
grant execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Recordatorio diario: schedule con listas y nombre del día
-- ---------------------------------------------------------------------------

-- Cambia lo que devuelve (routine_name), así que hay que borrarla antes.
-- security definer: la llama la app sin sesión de usuario (con el secreto) y lee los
-- recordatorios de todos.
drop function if exists public.pending_reminders(text);
create function public.pending_reminders(p_secret text)
returns table (user_id uuid, endpoint text, p256dh text, auth text, routine_day smallint, routine_name text, vapid_private text, is_test boolean)
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
           p.day_names,
           -- Día de rutina de hoy: schedule guarda una lista de días de la semana por día
           -- de rutina, o un número en el formato antiguo.
           (select min(s.key::smallint) from jsonb_each(coalesce(p.schedule, '{}'::jsonb)) s(key, value)
             where (case jsonb_typeof(s.value)
                      when 'array' then s.value @> to_jsonb(extract(isodow from l.local_now)::int)
                      when 'number' then (s.value #>> '{}')::numeric = extract(isodow from l.local_now)
                      else false end)
               and exists (select 1 from public.exercises e where e.program_id = p.id and e.day = s.key::smallint)) as today_day
    from local l
    left join public.programs p on p.user_id = l.user_id
  ), due as (
    select i.user_id, i.today_day, i.day_names, coalesce(i.test_at > now() - interval '15 minutes', false) as is_test
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
  select d.user_id, s.endpoint, s.p256dh, s.auth, d.today_day,
         coalesce(d.day_names ->> d.today_day::text,
                  '{"1": "Torso", "2": "Pierna", "3": "Empujes", "4": "Tirones", "5": "Hombros y brazos"}'::jsonb ->> d.today_day::text),
         (select value from private.settings where key = 'vapid_private'), d.is_test
  from due d
  join public.push_subscriptions s on s.user_id = d.user_id;
end;
$$;

revoke all on function public.pending_reminders(text) from public;
grant execute on function public.pending_reminders(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Quién levanta más: el día de más peso con todas sus series
-- ---------------------------------------------------------------------------

drop function if exists public.group_exercise_records(text);

-- security definer: lee las series de los demás miembros del grupo (RLS solo deja ver las
-- propias). Solo responde si quien llama es del grupo y respeta «ocultar mis pesos».
create function public.group_exercise_records(p_code text)
returns table (exercise text, display_name text, weight numeric, reps integer, total_reps integer, sets jsonb, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with sessions as (
    select m.user_id, m.display_name, e.name, lower(btrim(e.name)) as ex_key,
           max(l.weight) as top,
           (array_agg(l.reps order by l.weight desc nulls last, l.reps desc nulls last))[1] as top_reps,
           sum(coalesce(l.reps, 0))::integer as total_reps,
           jsonb_agg(jsonb_build_object('weight', l.weight, 'reps', l.reps) order by l.set_number) as sets
    from public.group_members m
    join public.programs p on p.user_id = m.user_id
    join public.exercises e on e.program_id = p.id
    join public.set_logs l on l.program_id = p.id and l.exercise_local_id = e.local_id
    where m.group_code = upper(p_code)
      and exists (select 1 from public.group_members me where me.group_code = upper(p_code) and me.user_id = auth.uid())
      and (m.user_id = auth.uid() or not exists (select 1 from public.profiles pr where pr.user_id = m.user_id and pr.hide_lifts))
      and l.set_number between 1 and 10
    group by m.user_id, m.display_name, e.name, e.local_id, l.week, l.day, l.round
    having max(l.weight) > 0
  )
  select distinct on (s.user_id, s.ex_key)
         s.name, s.display_name, s.top, s.top_reps, s.total_reps, s.sets, s.user_id = auth.uid()
  from sessions s
  order by s.user_id, s.ex_key, s.top desc, s.total_reps desc;
$$;

revoke execute on function public.group_exercise_records(text) from public, anon;
grant execute on function public.group_exercise_records(text) to authenticated;
