-- Nuevas funciones de la app:
--   · series de calentamiento (números de serie 11-13)
--   · superseries (exercises.superset)
--   · peso corporal y medidas (body_metrics)
--   · compartir rutinas con un código (shared_routines)
--   · grupos de amigos con clasificación de días entrenados (groups, group_members)

-- ---------------------------------------------------------------------------
-- Calentamiento y superseries
-- ---------------------------------------------------------------------------

alter table public.set_logs drop constraint set_logs_set_number_check;
alter table public.set_logs add constraint set_logs_set_number_check check (set_number between 0 and 13);

alter table public.exercises add column superset boolean not null default false;

-- ---------------------------------------------------------------------------
-- Peso corporal y medidas
-- ---------------------------------------------------------------------------

create table public.body_metrics (
  program_id uuid not null references public.programs (id) on delete cascade,
  date       date not null,
  weight     numeric(5, 1) check (weight > 0),
  waist      numeric(5, 1) check (waist > 0),
  chest      numeric(5, 1) check (chest > 0),
  arm        numeric(5, 1) check (arm > 0),
  thigh      numeric(5, 1) check (thigh > 0),
  hip        numeric(5, 1) check (hip > 0),
  primary key (program_id, date)
);

alter table public.body_metrics enable row level security;

create policy "Propietario gestiona sus medidas" on public.body_metrics
  for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())));

revoke all on public.body_metrics from anon;

-- replace_program (alta y restauración de copias) con superseries y medidas.
drop function public.replace_program(integer, jsonb, jsonb, jsonb, jsonb, date);

create function public.replace_program(
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

-- ---------------------------------------------------------------------------
-- Rutinas compartidas: quien la comparte obtiene un código de 6 caracteres;
-- quien lo conoce puede leerla (no se pueden listar todas).
-- ---------------------------------------------------------------------------

create table public.shared_routines (
  code       text primary key check (code ~ '^[A-Z0-9]{6}$'),
  routine    jsonb not null check (jsonb_typeof(routine) = 'array' and jsonb_array_length(routine) <= 200),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shared_routines enable row level security;

create policy "Compartir rutinas propias" on public.shared_routines
  for insert to authenticated
  with check (owner = (select auth.uid()));

revoke all on public.shared_routines from anon;

create function public.get_shared_routine(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select routine from public.shared_routines where code = upper(p_code) and auth.uid() is not null;
$$;

revoke execute on function public.get_shared_routine(text) from public, anon;
grant execute on function public.get_shared_routine(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Grupos de amigos y clasificación. Solo se accede mediante funciones: cada
-- miembro ve los nombres y el número de días entrenados de su grupo, nada más.
-- ---------------------------------------------------------------------------

create table public.groups (
  code       text primary key check (code ~ '^[A-Z0-9]{6}$'),
  name       text not null check (char_length(name) between 1 and 40),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_code   text not null references public.groups (code) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  joined_at    timestamptz not null default now(),
  primary key (group_code, user_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
revoke all on public.groups, public.group_members from anon, authenticated;

create function public.create_group(p_code text, p_name text, p_display text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  insert into public.groups (code, name, created_by) values (upper(p_code), p_name, v_user);
  insert into public.group_members (group_code, user_id, display_name) values (upper(p_code), v_user, p_display);
end;
$$;

create function public.join_group(p_code text, p_display text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  select name into v_name from public.groups where code = upper(p_code);
  if v_name is null then
    raise exception 'Grupo no encontrado' using errcode = 'P0002';
  end if;
  if (select count(*) from public.group_members where group_code = upper(p_code)) >= 50 then
    raise exception 'Grupo lleno' using errcode = 'P0001';
  end if;
  insert into public.group_members (group_code, user_id, display_name)
  values (upper(p_code), v_user, p_display)
  on conflict (group_code, user_id) do update set display_name = excluded.display_name;
  return v_name;
end;
$$;

create function public.leave_group(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.group_members where group_code = upper(p_code) and user_id = auth.uid();
  delete from public.groups g
  where g.code = upper(p_code)
    and not exists (select 1 from public.group_members m where m.group_code = g.code);
end;
$$;

create function public.my_groups()
returns table (code text, name text, members integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.code, g.name, (select count(*)::integer from public.group_members m2 where m2.group_code = g.code)
  from public.groups g
  join public.group_members m on m.group_code = g.code
  where m.user_id = auth.uid()
  order by g.created_at;
$$;

-- Días distintos entrenados por cada miembro entre dos fechas (series o ticks anotados).
create function public.group_leaderboard(p_code text, p_from date, p_to date)
returns table (display_name text, days integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.display_name,
         (select count(distinct l.logged_on)::integer
          from public.programs p
          join public.set_logs l on l.program_id = p.id
          where p.user_id = m.user_id and l.logged_on between p_from and p_to),
         m.user_id = auth.uid()
  from public.group_members m
  where m.group_code = upper(p_code)
    and exists (select 1 from public.group_members me where me.group_code = upper(p_code) and me.user_id = auth.uid())
  order by 2 desc, 1;
$$;

revoke execute on function public.create_group(text, text, text), public.join_group(text, text), public.leave_group(text),
  public.my_groups(), public.group_leaderboard(text, date, date) from public, anon;
grant execute on function public.create_group(text, text, text), public.join_group(text, text), public.leave_group(text),
  public.my_groups(), public.group_leaderboard(text, date, date) to authenticated;
