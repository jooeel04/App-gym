-- Atajo de iPhone: guarda las kcal del Apple Watch sin sesión, con una clave por cuenta
-- (spec ajustes R9–R10, datos R7). Se puede ejecutar más de una vez.
--
-- 1. programs.watch_token_hash: SHA-256 (hexadecimal) de la clave del atajo; null = sin
--    atajo. La clave nunca se guarda en claro.
-- 2. log_watch_kcal(): la llama /api/reloj (sin sesión) y guarda las kcal del día en
--    watch_energy del programa cuya clave coincide.

-- ---------------------------------------------------------------------------
-- 1. Clave del atajo (solo su hash)
-- ---------------------------------------------------------------------------

alter table public.programs add column if not exists watch_token_hash text;
alter table public.programs drop constraint if exists programs_watch_token_hash_check;
alter table public.programs add constraint programs_watch_token_hash_check
  check (watch_token_hash is null or watch_token_hash ~ '^[0-9a-f]{64}$');
create unique index if not exists programs_watch_token_hash_key on public.programs (watch_token_hash);

-- ---------------------------------------------------------------------------
-- 2. Guardar las kcal que manda el atajo
-- ---------------------------------------------------------------------------

-- security definer: el atajo no tiene sesión y RLS no le dejaría escribir. Para que sea
-- seguro, solo escribe en el programa cuya clave coincide (por su hash) y solo una fila de
-- watch_energy, con kcal y fecha comprobadas.
create or replace function public.log_watch_kcal(p_token text, p_date date, p_kcal integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program uuid;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128
     or p_kcal is null or p_kcal < 1 or p_kcal > 9999
     or p_date is null or p_date < current_date - 7 or p_date > current_date + 1 then
    return false;
  end if;

  select id into v_program from public.programs
  where watch_token_hash = encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex');
  if v_program is null then
    return false;
  end if;

  insert into public.watch_energy (program_id, date, kcal)
  values (v_program, p_date, p_kcal)
  on conflict (program_id, date) do update set kcal = excluded.kcal;
  return true;
end;
$$;

revoke execute on function public.log_watch_kcal(text, date, integer) from public;
grant execute on function public.log_watch_kcal(text, date, integer) to anon, authenticated;
