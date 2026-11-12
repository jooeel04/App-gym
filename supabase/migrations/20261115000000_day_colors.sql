-- Color de cada día de rutina (spec rutina R7, datos R5). Se puede ejecutar más de una vez.
--
-- 1. programs.day_colors: día de rutina → color elegido ({"3": "rojo"}); null o sin
--    clave = el color de siempre de ese día. Solo días 1–7 y colores de la lista de la app
--    (DAY_COLORS en src/domain/day-colors.ts).
-- 2. remove_routine_day(): al borrar un día guarda también cómo quedan los colores, en la
--    misma transacción (así un día nuevo con ese número sale con su color de siempre).
-- 3. replace_program(): copia también los colores (p_day_colors).

-- ---------------------------------------------------------------------------
-- 1. Colores de los días
-- ---------------------------------------------------------------------------

alter table public.programs add column if not exists day_colors jsonb;
alter table public.programs drop constraint if exists programs_day_colors_check;
alter table public.programs add constraint programs_day_colors_check
  check (day_colors is null or (
    jsonb_typeof(day_colors) = 'object'
    and pg_column_size(day_colors) <= 512
    and not jsonb_path_exists(day_colors, '$.keyvalue() ? (!(@.key like_regex "^[1-7]$"))')
    and not jsonb_path_exists(day_colors, '$.* ? (!(@ like_regex "^(azul|naranja|verde|amarillo|rosa|morado|turquesa|rojo)$"))')
  ));

-- ---------------------------------------------------------------------------
-- 2. Borrar un día de rutina (una transacción), ahora con los colores. security invoker:
--    RLS deja tocar solo el programa propio.
-- ---------------------------------------------------------------------------

drop function if exists public.remove_routine_day(uuid, smallint, jsonb, jsonb);
drop function if exists public.remove_routine_day(uuid, smallint, jsonb, jsonb, jsonb);

create function public.remove_routine_day(p_program_id uuid, p_day smallint, p_day_names jsonb, p_schedule jsonb, p_day_colors jsonb)
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
  update public.programs
  set day_names = p_day_names, schedule = p_schedule, day_colors = p_day_colors
  where id = p_program_id;
end;
$$;

revoke execute on function public.remove_routine_day(uuid, smallint, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.remove_routine_day(uuid, smallint, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. replace_program con los colores de los días
-- ---------------------------------------------------------------------------

drop function if exists public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb);
drop function if exists public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb, jsonb);

create function public.replace_program(
  p_weeks_count integer,
  p_exercises   jsonb,
  p_logs        jsonb,
  p_completed   jsonb,
  p_schedule    jsonb default null,
  p_start_date  date default null,
  p_body        jsonb default null,
  p_day_names   jsonb default null,
  p_day_colors  jsonb default null
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

revoke execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date, jsonb, jsonb, jsonb) to authenticated, service_role;
