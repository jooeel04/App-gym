-- Kcal del reloj por fecha (spec hoy R32, datos R6). Se puede ejecutar más de una vez.
--
-- 1. watch_energy: (programa, fecha) → kcal que dijo el reloj ese día (1–9999). Tabla
--    propia: no es una medida del cuerpo (body_metrics) y la escriben el reloj o el atajo.
-- 2. replace_program(): copia también las kcal del reloj (p_watch_kcal).

-- ---------------------------------------------------------------------------
-- 1. Kcal del reloj
-- ---------------------------------------------------------------------------

create table if not exists public.watch_energy (
  program_id uuid not null references public.programs (id) on delete cascade,
  date       date not null,
  kcal       smallint not null check (kcal between 1 and 9999),
  primary key (program_id, date)
);

alter table public.watch_energy enable row level security;

drop policy if exists "Propietario gestiona sus kcal del reloj" on public.watch_energy;
create policy "Propietario gestiona sus kcal del reloj" on public.watch_energy
  for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())));

revoke all on public.watch_energy from anon;
grant select, insert, update, delete on public.watch_energy to authenticated;

-- ---------------------------------------------------------------------------
-- 2. replace_program con las kcal del reloj
-- ---------------------------------------------------------------------------

drop function if exists public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb, jsonb);
drop function if exists public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb, jsonb, jsonb);

create function public.replace_program(
  p_weeks_count integer,
  p_exercises   jsonb,
  p_logs        jsonb,
  p_completed   jsonb,
  p_schedule    jsonb default null,
  p_start_date  date default null,
  p_body        jsonb default null,
  p_day_names   jsonb default null,
  p_day_colors  jsonb default null,
  p_watch_kcal  jsonb default null
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
      day_names   = p_day_names,
      day_colors  = p_day_colors
  where id = v_program;

  -- Al borrar los ejercicios se borran en cascada sus series.
  delete from public.exercises where program_id = v_program;
  delete from public.completed_days where program_id = v_program;
  delete from public.body_metrics where program_id = v_program;
  delete from public.watch_energy where program_id = v_program;

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

  insert into public.watch_energy (program_id, date, kcal)
  select v_program, (k ->> 'date')::date, (k ->> 'kcal')::smallint
  from jsonb_array_elements(coalesce(p_watch_kcal, '[]'::jsonb)) as t(k)
  on conflict do nothing;

  return v_program;
end;
$$;

revoke execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb, jsonb, jsonb) to authenticated, service_role;
