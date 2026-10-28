-- Los ticks manuales (serie 0) no tienen carga, repeticiones ni nota: la regla que
-- exige al menos uno de los tres solo se aplica a las series reales (1-10).

alter table public.set_logs drop constraint set_logs_check;
alter table public.set_logs add constraint set_logs_check
  check (set_number = 0 or weight is not null or reps is not null or note is not null);
