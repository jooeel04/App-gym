-- Modo app personal (sin login).
--
-- La app accede desde el servidor con la clave secreta (rol service_role), que
-- no tiene auth.uid(). Se admite un único programa sin usuario (user_id null).
-- RLS sigue activo: las claves públicas (anon / authenticated) no ven estos datos.

alter table public.programs
  alter column user_id drop not null,
  alter column user_id drop default;

-- Como máximo un programa sin dueño.
create unique index programs_single_owner_idx on public.programs ((true)) where user_id is null;

-- replace_program: usa el programa del usuario autenticado o, con la clave
-- secreta del servidor, el programa único sin dueño.
create or replace function public.replace_program(
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
  else
    update public.programs set weeks_count = p_weeks_count where id = v_program;
  end if;

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

-- El servidor usa el rol service_role: necesita permiso explícito para las funciones.
grant execute on function public.replace_program(integer, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.remove_week(uuid, integer) to service_role;
grant all on public.programs, public.exercises, public.set_logs, public.completed_days to service_role;
