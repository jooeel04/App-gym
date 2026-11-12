-- Repetir un día de rutina en la misma semana (spec datos R1, hoy R15–R16).
--
-- Antes, cada día de rutina se podía anotar una sola vez por semana: la clave de
-- set_logs y completed_days era (programa, semana, día…). Ahora cada tanda del mismo día
-- en una semana es una «vez» (round = 1, 2, 3…) y entra en la clave primaria. Lo ya
-- guardado queda como la 1.ª vez (default 1). replace_program (copias) lee la vez de cada
-- serie y día completado (1 si no viene). Se puede ejecutar más de una vez.

alter table public.set_logs
  add column if not exists round smallint not null default 1;
alter table public.set_logs drop constraint if exists set_logs_round_check;
alter table public.set_logs add constraint set_logs_round_check check (round between 1 and 20);
alter table public.set_logs drop constraint if exists set_logs_pkey;
alter table public.set_logs add constraint set_logs_pkey
  primary key (program_id, week, day, round, exercise_local_id, set_number);

alter table public.completed_days
  add column if not exists round smallint not null default 1;
alter table public.completed_days drop constraint if exists completed_days_round_check;
alter table public.completed_days add constraint completed_days_round_check check (round between 1 and 20);
alter table public.completed_days drop constraint if exists completed_days_pkey;
alter table public.completed_days add constraint completed_days_pkey
  primary key (program_id, week, day, round);

-- replace_program (alta y restauración de copias) con la vez de cada serie y día.
create or replace function public.replace_program(
  p_weeks_count integer,
  p_exercises   jsonb,
  p_logs        jsonb,
  p_completed   jsonb,
  p_schedule    jsonb default null,
  p_start_date  date default null,
  p_body        jsonb default null
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

revoke execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb) from public, anon;
grant execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb) to authenticated, service_role;
