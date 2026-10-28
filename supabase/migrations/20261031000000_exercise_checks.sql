-- Ticks manuales por ejercicio.
--
-- Un ejercicio marcado a mano (p. ej. porque no se pudo hacer) se guarda en
-- set_logs como la "serie 0", sin carga ni repeticiones y con la fecha en que se
-- marcó en logged_on. Así se borra en cascada con el ejercicio, se renumera con
-- remove_week y se copia con replace_program sin cambiar esas funciones.

alter table public.set_logs drop constraint set_logs_set_number_check;
alter table public.set_logs add constraint set_logs_set_number_check check (set_number between 0 and 10);
