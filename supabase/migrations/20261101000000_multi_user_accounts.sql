-- Cuentas de usuario (varias personas, cada una con sus datos).
--
-- El servidor vuelve a acceder con la sesión de cada usuario (rol authenticated),
-- así que las políticas RLS de la migración inicial separan los datos: cada
-- usuario solo ve y modifica su propio programa (programs.user_id = auth.uid()).
--
-- El programa sin dueño (user_id null) del modo sin login lo reclama la primera
-- cuenta que entra y todavía no tiene programa, para no perder los registros.

-- Programas nuevos: el dueño es el usuario que los crea.
alter table public.programs alter column user_id set default auth.uid();

create function public.claim_unowned_program()
returns boolean
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
  if exists (select 1 from public.programs where user_id = v_user) then
    return false;
  end if;
  update public.programs set user_id = v_user where user_id is null;
  return found;
end;
$$;

revoke execute on function public.claim_unowned_program() from public, anon;
grant execute on function public.claim_unowned_program() to authenticated;
