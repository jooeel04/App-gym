-- Datos demo para la base de datos LOCAL (Docker con la CLI de Supabase).
--
-- Solo lo ejecuta la CLI al crear la base local (`npm run db:start` la primera vez
-- o `npm run db:reset`). Nunca se ejecuta en el proyecto de producción.
--
-- Cuentas (contraseña de todas: demo1234):
--   demo@rutina.local  1 año de entrenos (52 semanas), peso corporal y medidas
--   ana@rutina.local   ~9 meses (40 semanas)
--   leo@rutina.local   ~6 meses (26 semanas), 3 días por semana
-- Racha actual (semanas completas seguidas), como mínimo: demo 8, ana 4, leo 3.
-- Las tres están en el grupo de amigos «Colegas del gym» (código DEMO01).
--
-- Las fechas se calculan desde el día en que se carga: la última semana del ciclo
-- es siempre la semana actual y hoy queda sin anotar.

-- El recordatorio programado (pg_cron) llama a la app de producción: en local no.
do $$
begin
  perform cron.unschedule('rutina-recordatorios');
exception when others then null;
end;
$$;

-- Mismos datos "aleatorios" en cada carga.
select setseed(0.42);

-- ---------------------------------------------------------------------------
-- Cuentas
-- ---------------------------------------------------------------------------

create temporary table demo_users (
  id         uuid primary key,
  email      text,
  display    text,
  weeks      integer,  -- semanas de historial (la última es la actual)
  attendance numeric,  -- probabilidad de ir cada día
  strength   numeric,  -- multiplicador de las cargas de la rutina base
  schedule   jsonb,    -- día de rutina → día de la semana
  body_from  numeric,  -- peso corporal al empezar…
  body_to    numeric,  -- …y ahora
  streak     integer   -- últimas semanas sin faltar (racha actual)
);

insert into demo_users values
  ('00000000-0000-4000-8000-000000000001', 'demo@rutina.local', 'Demo', 52, 0.88, 1.00,
   '{"1": 1, "2": 2, "3": 3, "4": 4, "5": 5}', 84.0, 78.5, 8),
  ('00000000-0000-4000-8000-000000000002', 'ana@rutina.local', 'Ana', 40, 0.80, 0.60,
   '{"1": 1, "2": 2, "3": 4, "4": 5, "5": 0}', 63.0, 60.5, 4),
  ('00000000-0000-4000-8000-000000000003', 'leo@rutina.local', 'Leo', 26, 0.72, 1.15,
   '{"1": 1, "2": 3, "3": 5, "4": 0, "5": 0}', 91.0, 88.0, 3);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
       '{"provider": "email", "providers": ["email"]}', '{}',
       now() - make_interval(weeks => u.weeks), now(),
       '', '', '', '', '', ''
from demo_users u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from demo_users u;

-- ---------------------------------------------------------------------------
-- Rutina base (la misma que src/domain/base-routine.ts) con la carga inicial en kg
-- de la cuenta demo. Carga null = peso corporal.
-- ---------------------------------------------------------------------------

create temporary table demo_routine (
  local_id      integer,
  day           smallint,
  group_name    text,
  name          text,
  note          text,
  prescription  text,
  sets          smallint,
  target        text,
  optional_last boolean,
  base          numeric
);

insert into demo_routine values
  (0,  1, 'Torso', 'Press inclinado en multipower', 'Foco en pecho superior.', '3 × 8–10', 3, '8–10', false, 50),
  (1,  1, 'Torso', 'Dominadas excéntricas', 'Salta al cajón y frena la bajada durante 3–5 s. Haz este bloque antes de las dominadas con goma.', '2–3 · sin rango', 3, 'Sin rango', true, null),
  (2,  1, 'Torso', 'Dominadas con goma actual', 'Haz este bloque justo después de las excéntricas.', '2–3 × 6–8', 3, '6–8', true, null),
  (3,  1, 'Torso', 'Press plano con mancuernas', 'Usa un rango libre y baja profundo para estirar el pecho.', '3 × 10–12', 3, '10–12', false, 22),
  (4,  1, 'Torso', 'Remo con barra', 'Movimiento principal para trabajar densidad de espalda.', '3 × 8–10', 3, '8–10', false, 55),
  (5,  1, 'Torso', 'Cruce de poleas desde arriba', 'Mantén la tensión durante todo el recorrido.', '3 × 12–15', 3, '12–15', false, 12.5),
  (6,  1, 'Torso', 'Pullover en polea alta', 'Usa cuerda o barra. Enfoque en dorsal con poca intervención del bíceps.', '3 × 12–15', 3, '12–15', false, 20),
  (7,  2, 'Pierna', 'Hip thrust en máquina', '', '3 × 8–10', 3, '8–10', false, 80),
  (8,  2, 'Pierna', 'Sentadilla búlgara contralateral', '', '2 × 10–12', 2, '10–12', false, 14),
  (9,  2, 'Pierna', 'Sentadilla en multipower', '', '3 × 10–12', 3, '10–12', false, 60),
  (10, 2, 'Pierna', 'Extensión de cuádriceps', '', '3 × 10–15', 3, '10–15', false, 45),
  (11, 2, 'Pierna', 'Curl femoral tumbado', '', '3 × 10–15', 3, '10–15', false, 35),
  (12, 2, 'Pierna', 'Gemelo en máquina', '', '3 × 12–15', 3, '12–15', false, 60),
  (13, 3, 'Empujes', 'Press militar con mancuernas', '', '3 × 6–8', 3, '6–8', false, 18),
  (14, 3, 'Empujes', 'Press inclinado en máquina', '', '3 × 8–10', 3, '8–10', false, 50),
  (15, 3, 'Empujes', 'Fondos excéntricos', 'Salta hasta bloquear los codos y controla la bajada. Haz este bloque antes de los fondos asistidos.', '2–3 · sin rango', 3, 'Sin rango', true, null),
  (16, 3, 'Empujes', 'Fondos con goma o contrapeso', 'Inclina ligeramente el torso hacia delante para enfatizar el pectoral inferior.', '2–3 · sin rango', 3, 'Sin rango', true, null),
  (17, 3, 'Empujes', 'Elevaciones laterales en polea unilateral', '', '3 × 10–15', 3, '10–15', false, 5),
  (18, 3, 'Empujes', 'Press francés con mancuernas', '', '3 × 8–12', 3, '8–12', false, 12),
  (19, 3, 'Empujes', 'Crunch abdominal en máquina', '', '3 × 10–15', 3, '10–15', false, 40),
  (20, 4, 'Tirones', 'Remo en T con agarre neutro', '', '3 × 8–12', 3, '8–12', false, 40),
  (21, 4, 'Tirones', 'Jalón prono al pecho', 'Añade volumen de espalda sin repetir el esfuerzo de dominadas del Día 1.', '3 × 12–15', 3, '12–15', false, 50),
  (22, 4, 'Tirones', 'Face pull en polea', 'Enfoque en postura y salud del hombro.', '3 × 12–15', 3, '12–15', false, 20),
  (23, 4, 'Tirones', 'Dead curl', '', '3 × 6–8', 3, '6–8', false, 12),
  (24, 4, 'Tirones', 'Curl de bíceps bayasi unilateral', '', '3 × 10–12', 3, '10–12', false, 7.5),
  (25, 4, 'Tirones', 'Aductor en máquina', 'Cierra las piernas durante el movimiento.', '3 × 10–12', 3, '10–12', false, 50),
  (26, 5, 'Hombros y brazos', 'Press militar en máquina', '', '2 × 10–12', 2, '10–12', false, 35),
  (27, 5, 'Hombros y brazos', 'Elevaciones laterales con mancuernas', '', '3 × 10–15', 3, '10–15', false, 8),
  (28, 5, 'Hombros y brazos', 'Curl Scott en máquina', '', '3 × 8–10', 3, '8–10', false, 25),
  (29, 5, 'Hombros y brazos', 'Extensión de tríceps en polea unilateral', '', '3 × 12–15', 3, '12–15', false, 10),
  (30, 5, 'Hombros y brazos', 'Curl martillo con mancuernas', 'Enfoca el braquial.', '3 × 10–12', 3, '10–12', false, 12),
  (31, 5, 'Hombros y brazos', 'Crunch abdominal en máquina', 'Segundo día de abdomen para trabajar la estabilización del core.', '3 × 10–15', 3, '10–15', false, 40);

-- ---------------------------------------------------------------------------
-- Programas, series, días completados y medidas
-- ---------------------------------------------------------------------------

do $$
declare
  u          record;
  ex         record;
  v_program  uuid;
  v_monday   date := date_trunc('week', current_date)::date;  -- lunes de esta semana
  v_start    date;
  v_date     date;
  v_logged   date;
  v_weekday  integer;
  v_w        integer;
  v_d        integer;
  v_s        integer;
  v_sets     integer;
  v_lo       integer;
  v_hi       integer;
  v_reps     integer;
  v_load     numeric;
  v_step     numeric;
  v_first    boolean;
  v_body     numeric;
  v_notes    text[] := array['Buenas sensaciones', 'Última serie al fallo', 'Subir peso la próxima',
                             'Molestia leve en el hombro', 'Poco descanso entre series', 'Técnica muy limpia hoy'];
begin
  for u in select * from demo_users loop
    v_start := v_monday - (u.weeks - 1) * 7;

    insert into public.programs (user_id, weeks_count, schedule, start_date, created_at)
    values (u.id, u.weeks, u.schedule, v_start, v_start)
    returning id into v_program;

    insert into public.exercises
      (program_id, local_id, day, position, group_name, name, note, prescription, sets, target, optional_last, created_at)
    select v_program, r.local_id, r.day, r.local_id + 1, r.group_name, r.name, r.note, r.prescription,
           r.sets, r.target, r.optional_last, v_start
    from demo_routine r
    where (u.schedule ->> r.day::text)::integer >= 1;

    for v_w in 1 .. u.weeks loop
      for v_d in 1 .. 5 loop
        v_weekday := (u.schedule ->> v_d::text)::integer;
        continue when v_weekday is null or v_weekday < 1;
        v_date := v_start + (v_w - 1) * 7 + (v_weekday - 1);
        continue when v_date >= current_date;  -- hoy y lo que viene, sin anotar

        -- Vacaciones (agosto y Navidad) y algún día suelto sin ir. A veces el día
        -- perdido se recupera el sábado. En las últimas semanas no se falta nunca,
        -- para que haya una racha en curso.
        v_logged := v_date;
        if to_char(v_date, 'MMDD') between '0804' and '0817'
           or to_char(v_date, 'MMDD') >= '1224' or to_char(v_date, 'MMDD') <= '0101' then
          continue;
        end if;
        if v_w < u.weeks - u.streak and random() > u.attendance then
          v_logged := v_start + (v_w - 1) * 7 + 5;
          continue when random() > 0.35 or v_logged >= current_date;
        end if;

        v_first := true;
        for ex in
          select * from demo_routine r where r.day = v_d order by r.local_id
        loop
          -- De vez en cuando un ejercicio solo se marca como hecho (serie 0).
          if random() < 0.03 then
            insert into public.set_logs (program_id, week, day, exercise_local_id, set_number, logged_on)
            values (v_program, v_w, v_d, ex.local_id, 0, v_logged);
            continue;
          end if;

          -- Carga de la semana: sube rápido al principio y luego más despacio;
          -- descarga (-15 %) cada 8 semanas.
          v_load := null;
          if ex.base is not null then
            v_load := ex.base * u.strength * (1 + 0.35 * (1 - exp(-(v_w - 1) / 26.0)));
            if v_w % 8 = 0 then v_load := v_load * 0.85; end if;
            v_step := case when v_load >= 20 then 2.5 when v_load >= 8 then 1 else 0.5 end;
            v_load := round(v_load / v_step) * v_step;
          end if;

          if ex.target = 'Sin rango' then
            v_lo := 3; v_hi := 6;
          else
            v_lo := split_part(ex.target, '–', 1)::integer;
            v_hi := split_part(ex.target, '–', 2)::integer;
          end if;

          -- Calentamiento (series 11-12) en el primer ejercicio con carga del día.
          if v_first and v_load is not null and random() < 0.7 then
            insert into public.set_logs (program_id, week, day, exercise_local_id, set_number, weight, reps, logged_on)
            values (v_program, v_w, v_d, ex.local_id, 11, round(v_load * 0.5 / 2.5) * 2.5, 10, v_logged),
                   (v_program, v_w, v_d, ex.local_id, 12, round(v_load * 0.75 / 2.5) * 2.5, 5, v_logged);
          end if;
          if v_load is not null then v_first := false; end if;

          v_sets := ex.sets;
          if ex.optional_last and random() < 0.5 then v_sets := v_sets - 1; end if;

          for v_s in 1 .. v_sets loop
            -- Más repeticiones en la primera serie que en las siguientes.
            v_reps := greatest(v_lo - 1, v_hi - (v_s - 1) - floor(random() * (v_hi - v_lo + 1))::integer);
            insert into public.set_logs (program_id, week, day, exercise_local_id, set_number, weight, reps, note, logged_on)
            values (v_program, v_w, v_d, ex.local_id, v_s, v_load, v_reps,
                    case when random() < 0.02 then v_notes[1 + floor(random() * array_length(v_notes, 1))::integer] end,
                    v_logged);
          end loop;
        end loop;

        insert into public.completed_days (program_id, week, day, created_at)
        values (v_program, v_w, v_d, v_logged + time '19:30');
      end loop;

      -- Peso corporal casi todos los lunes; medidas una vez al mes.
      v_date := v_start + (v_w - 1) * 7;
      if v_date <= current_date and random() < 0.85 then
        v_body := u.body_from + (u.body_to - u.body_from) * (v_w - 1) / greatest(u.weeks - 1, 1)
                  + (random() - 0.5) * 0.8;
        insert into public.body_metrics (program_id, date, weight, waist, chest, arm, thigh, hip)
        values (v_program, v_date, round(v_body, 1),
                case when v_w % 4 = 1 then round(v_body * 1.02 + random()::numeric, 1) end,
                case when v_w % 4 = 1 then round(v_body * 1.2 + v_w * 0.05, 1) end,
                case when v_w % 4 = 1 then round(v_body * 0.42 + v_w * 0.02, 1) end,
                case when v_w % 4 = 1 then round(v_body * 0.7 + random()::numeric, 1) end,
                case when v_w % 4 = 1 then round(v_body * 1.18 + random()::numeric, 1) end);
      end if;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grupo de amigos y recordatorio
-- ---------------------------------------------------------------------------

insert into public.groups (code, name, created_by)
values ('DEMO01', 'Colegas del gym', '00000000-0000-4000-8000-000000000001');

insert into public.group_members (group_code, user_id, display_name)
select 'DEMO01', u.id, u.display from demo_users u;

insert into public.reminders (user_id, time_of_day, mode)
values ('00000000-0000-4000-8000-000000000001', '18:30', 'training');

drop table demo_users;
drop table demo_routine;
