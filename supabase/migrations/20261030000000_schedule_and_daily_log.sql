-- Calendario semanal y registro diario.
--
-- programs.schedule    día de la rutina (1-5) → día de la semana (1 = lunes … 7 = domingo)
-- programs.start_date  lunes en que empieza la semana 1 del ciclo
-- set_logs.logged_on   fecha real en que se anotó la serie (permite recuperar días)

alter table public.programs
  add column schedule   jsonb not null default '{"1": 1, "2": 2, "3": 3, "4": 4, "5": 5}'::jsonb
    check (jsonb_typeof(schedule) = 'object'),
  add column start_date date
    check (start_date is null or extract(isodow from start_date) = 1);

alter table public.set_logs add column logged_on date;

create index set_logs_logged_on_idx on public.set_logs (program_id, logged_on);

-- replace_program con calendario y fechas de las series.
drop function public.replace_program(integer, jsonb, jsonb, jsonb);

create function public.replace_program(
  p_weeks_count integer,
  p_exercises   jsonb,
  p_logs        jsonb,
  p_completed   jsonb,
  p_schedule    jsonb default null,
  p_start_date  date default null
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
      start_date  = p_start_date
  where id = v_program;

  -- Al borrar los ejercicios se borran en cascada sus series.
  delete from public.exercises where program_id = v_program;
  delete from public.completed_days where program_id = v_program;

  insert into public.exercises
    (program_id, local_id, day, position, group_name, name, note, prescription, sets, target, optional_last, custom)
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
         coalesce((e ->> 'custom')::boolean, false)
  from jsonb_array_elements(p_exercises) with ordinality as t(e, ord);

  insert into public.set_logs (program_id, week, day, exercise_local_id, set_number, weight, reps, note, logged_on)
  select v_program,
         (l ->> 'week')::integer,
         (l ->> 'day')::smallint,
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

  insert into public.completed_days (program_id, week, day)
  select v_program, (c ->> 'week')::integer, (c ->> 'day')::smallint
  from jsonb_array_elements(p_completed) as t(c)
  on conflict do nothing;

  return v_program;
end;
$$;

revoke execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date) from public, anon;
grant execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date) to authenticated, service_role;
