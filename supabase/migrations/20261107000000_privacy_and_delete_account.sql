-- Ajustes nuevos de la cuenta.
--
-- profiles.hide_lifts   no salir en «Quién levanta más» de los grupos de amigos
-- set_lift_privacy()    lo cambia (aunque la persona aún no tenga apodo)
-- delete_my_account()   borra la cuenta; sus datos se borran en cascada
-- Se puede ejecutar más de una vez.

alter table public.profiles add column if not exists hide_lifts boolean not null default false;
-- Para guardar la privacidad sin tener apodo todavía.
alter table public.profiles alter column nickname drop not null;

create or replace function public.set_lift_privacy(p_hide boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  insert into public.profiles (user_id, hide_lifts, updated_at) values (auth.uid(), coalesce(p_hide, false), now())
  on conflict (user_id) do update set hide_lifts = excluded.hide_lifts, updated_at = now();
end;
$$;

-- Igual que antes, sin las personas que ocultan sus pesos (cada uno se sigue viendo a sí mismo).
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
    and (m.user_id = auth.uid() or not exists (select 1 from public.profiles pr where pr.user_id = m.user_id and pr.hide_lifts))
    and l.set_number between 1 and 10
    and l.weight > 0
  order by m.user_id, lower(btrim(e.name)), l.weight desc, l.reps desc nulls last;
$$;

-- Borra la cuenta de quien la llama. Todas sus tablas apuntan a auth.users con
-- "on delete cascade", así que su rutina, registros, grupos y avisos se van con ella.
-- Los grupos que creó y tienen más gente pasan al miembro más antiguo, para que sus
-- amigos no pierdan el grupo.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sin sesión'; end if;
  update public.groups g
     set created_by = (select m.user_id from public.group_members m
                        where m.group_code = g.code and m.user_id <> v_user
                        order by m.joined_at limit 1)
   where g.created_by = v_user
     and exists (select 1 from public.group_members m where m.group_code = g.code and m.user_id <> v_user);
  delete from auth.users where id = v_user;
end;
$$;

revoke execute on function public.set_lift_privacy(boolean), public.delete_my_account() from public, anon;
grant execute on function public.set_lift_privacy(boolean), public.delete_my_account() to authenticated;
