-- Apodo de cada persona y clasificación de amigos por peso levantado.
--
-- profiles                 el nombre o apodo con el que la app se dirige a cada uno
-- set_nickname()           lo guarda y lo pone también en sus grupos de amigos
-- group_exercise_records() la mejor serie (más peso) de cada miembro en cada ejercicio,
--                          para comparar quién levanta más (solo series de trabajo)
-- Se puede ejecutar más de una vez.

create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nickname   text not null check (char_length(btrim(nickname)) between 1 and 30),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "profiles: propio" on public.profiles;
create policy "profiles: propio" on public.profiles
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Guarda el apodo y lo usa como nombre en todos los grupos de amigos de esa persona.
create or replace function public.set_nickname(p_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(p_nickname);
begin
  if v_user is null then raise exception 'Sin sesión'; end if;
  if v_name is null or char_length(v_name) not between 1 and 30 then raise exception 'Apodo no válido'; end if;
  insert into public.profiles (user_id, nickname, updated_at) values (v_user, v_name, now())
  on conflict (user_id) do update set nickname = excluded.nickname, updated_at = now();
  update public.group_members set display_name = v_name where user_id = v_user;
end;
$$;

-- Mejor serie de cada miembro del grupo en cada ejercicio: la de más peso (y, con el
-- mismo peso, más repeticiones). Los ejercicios se juntan por nombre (sin mayúsculas ni
-- espacios de sobra), porque cada uno tiene su propia rutina. Solo para miembros del grupo.
create or replace function public.group_exercise_records(p_code text)
returns table (exercise text, display_name text, weight numeric, reps integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (m.user_id, lower(btrim(e.name)))
         e.name, m.display_name, l.weight, l.reps, m.user_id = auth.uid()
  from public.group_members m
  join public.programs p on p.user_id = m.user_id
  join public.exercises e on e.program_id = p.id
  join public.set_logs l on l.program_id = p.id and l.exercise_local_id = e.local_id
  where m.group_code = upper(p_code)
    and exists (select 1 from public.group_members me where me.group_code = upper(p_code) and me.user_id = auth.uid())
    and l.set_number between 1 and 10
    and l.weight > 0
  order by m.user_id, lower(btrim(e.name)), l.weight desc, l.reps desc nulls last;
$$;

revoke execute on function public.set_nickname(text), public.group_exercise_records(text) from public, anon;
grant execute on function public.set_nickname(text), public.group_exercise_records(text) to authenticated;
