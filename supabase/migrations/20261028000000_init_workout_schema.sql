-- Esquema inicial de RUTINA · Seguimiento.
--
-- programs        1 por usuario: plan con número de semanas
-- exercises       ejercicios del plan por día (local_id = id que usa la app)
-- set_logs        registro por semana/día/ejercicio/serie: carga, repeticiones y nota
-- completed_days  días marcados como completados
--
-- Toda la seguridad depende de RLS: cada usuario solo accede a su propio programa.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default 'Rutina' check (char_length(name) between 1 and 80),
  weeks_count integer not null default 8 check (weeks_count between 1 and 520),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs (id) on delete cascade,
  local_id      integer not null check (local_id >= 0),
  day           smallint not null check (day between 1 and 5),
  position      integer not null default 0,
  group_name    text not null default '',
  name          text not null check (char_length(name) between 1 and 80),
  note          text not null default '' check (char_length(note) <= 240),
  prescription  text not null default '',
  sets          smallint not null check (sets between 1 and 10),
  target        text not null default 'Sin rango' check (char_length(target) <= 30),
  optional_last boolean not null default false,
  custom        boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (program_id, local_id)
);

create table public.set_logs (
  program_id        uuid not null,
  week              integer not null check (week >= 1),
  day               smallint not null check (day between 1 and 5),
  exercise_local_id integer not null,
  set_number        smallint not null check (set_number between 1 and 10),
  weight            numeric(6, 2) check (weight >= 0),
  reps              integer check (reps >= 0),
  note              text check (char_length(note) <= 160),
  updated_at        timestamptz not null default now(),
  primary key (program_id, week, day, exercise_local_id, set_number),
  foreign key (program_id, exercise_local_id)
    references public.exercises (program_id, local_id) on delete cascade,
  check (weight is not null or reps is not null or note is not null)
);

create table public.completed_days (
  program_id uuid not null references public.programs (id) on delete cascade,
  week       integer not null check (week >= 1),
  day        smallint not null check (day between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (program_id, week, day)
);

create index exercises_program_position_idx on public.exercises (program_id, day, position);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger programs_touch before update on public.programs
  for each row execute function public.touch_updated_at();
create trigger set_logs_touch before update on public.set_logs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.programs       enable row level security;
alter table public.exercises      enable row level security;
alter table public.set_logs       enable row level security;
alter table public.completed_days enable row level security;

create policy "Propietario gestiona su programa" on public.programs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Propietario gestiona sus ejercicios" on public.exercises
  for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())));

create policy "Propietario gestiona sus series" on public.set_logs
  for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())));

create policy "Propietario gestiona sus días completados" on public.completed_days
  for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())));

-- Los usuarios anónimos no tienen acceso a nada.
revoke all on public.programs, public.exercises, public.set_logs, public.completed_days from anon;

-- ---------------------------------------------------------------------------
-- Funciones (security invoker: se ejecutan con los permisos y RLS del usuario)
-- ---------------------------------------------------------------------------

-- Sustituye el programa completo del usuario en una sola transacción.
-- Se usa al crear la cuenta (migrando los datos locales) y al restaurar una copia.
create function public.replace_program(
  p_weeks_count integer,
  p_exercises   jsonb,
  p_logs        jsonb,
  p_completed   jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_program uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  insert into public.programs (user_id, weeks_count)
  values (auth.uid(), p_weeks_count)
  on conflict (user_id) do update set weeks_count = excluded.weeks_count
  returning id into v_program;

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

  insert into public.set_logs (program_id, week, day, exercise_local_id, set_number, weight, reps, note)
  select v_program,
         (l ->> 'week')::integer,
         (l ->> 'day')::smallint,
         (l ->> 'exercise')::integer,
         (l ->> 'set')::smallint,
         (l ->> 'weight')::numeric,
         (l ->> 'reps')::integer,
         nullif(l ->> 'note', '')
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

-- Elimina una semana y renumera las posteriores.
create function public.remove_week(p_program_id uuid, p_week integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.set_logs       where program_id = p_program_id and week = p_week;
  delete from public.completed_days where program_id = p_program_id and week = p_week;

  -- Renumeración en dos pasos para no chocar con la clave primaria.
  update public.set_logs set week = week + 100000 where program_id = p_program_id and week > p_week;
  update public.set_logs set week = week - 100001 where program_id = p_program_id and week > 100000;
  update public.completed_days set week = week + 100000 where program_id = p_program_id and week > p_week;
  update public.completed_days set week = week - 100001 where program_id = p_program_id and week > 100000;

  update public.programs set weeks_count = greatest(1, weeks_count - 1) where id = p_program_id;
end;
$$;

revoke execute on function public.replace_program(integer, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.remove_week(uuid, integer) from public, anon;
grant execute on function public.replace_program(integer, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.remove_week(uuid, integer) to authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
