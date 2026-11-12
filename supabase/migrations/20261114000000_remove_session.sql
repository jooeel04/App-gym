-- Borrar un entreno entero o cambiarle la fecha desde el historial o el calendario de
-- Progreso (spec progreso R7 y R9, datos R4), cada cosa en una sola transacción.
-- Se puede ejecutar más de una vez.

-- security invoker: RLS solo deja borrar filas del programa propio.
create or replace function public.remove_session(p_program_id uuid, p_week integer, p_day smallint, p_round smallint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.set_logs
  where program_id = p_program_id and week = p_week and day = p_day and round = p_round;
  delete from public.completed_days
  where program_id = p_program_id and week = p_week and day = p_day and round = p_round;
end;
$$;

revoke execute on function public.remove_session(uuid, integer, smallint, smallint) from public, anon;
grant execute on function public.remove_session(uuid, integer, smallint, smallint) to authenticated;

-- Lleva un entreno (la vez p_round del día p_day en la semana p_week) a otra fecha. Si es
-- de otra semana, pasa a p_to_week con la vez p_to_round (la primera libre: la elige la app).
-- security invoker: RLS solo deja cambiar filas del programa propio.
create or replace function public.move_session(
  p_program_id uuid, p_week integer, p_day smallint, p_round smallint,
  p_to_week integer, p_to_round smallint, p_date date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.set_logs
  set week = p_to_week, round = p_to_round, logged_on = p_date
  where program_id = p_program_id and week = p_week and day = p_day and round = p_round;
  update public.completed_days
  set week = p_to_week, round = p_to_round
  where program_id = p_program_id and week = p_week and day = p_day and round = p_round;
end;
$$;

revoke execute on function public.move_session(uuid, integer, smallint, smallint, integer, smallint, date) from public, anon;
grant execute on function public.move_session(uuid, integer, smallint, smallint, integer, smallint, date) to authenticated;
