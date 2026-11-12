# Datos

Dónde y cómo se guarda todo: las tablas de Supabase con sus reglas (RLS), las funciones
SQL y la copia en el dispositivo que permite usar la app sin conexión.

## Archivos clave

- `supabase/migrations/` — esquema, RLS y funciones (se ejecutan a mano en el SQL Editor).
- `supabase/seed.sql` — datos demo.
- `src/domain/types.ts` — `WorkoutSnapshot` (el estado entero, también el formato de las
  copias JSON) y `WorkoutChange` (cada cambio que se guarda).
- `src/domain/snapshot.ts` — claves de `entries`, `completed` y `checked`.
- `src/repositories/supabase-workout-repository.ts` — lee y escribe en Supabase.
- `src/repositories/server-action-workout-repository.ts` — guarda primero en el
  dispositivo y envía por Server Actions.
- `src/app/actions/workout.ts` — valida cada cambio antes de escribirlo.

## Funcionalidades

### Varias tandas del mismo día en una semana

**Qué hace:** un día de rutina se puede hacer varias veces en la misma semana (ver
`specs/hoy.md`). Cada tanda es una «vez» (1, 2, 3…).
**Cómo funciona:** `set_logs` y `completed_days` tienen la columna `round` (smallint, 1–20,
por defecto 1) y entra en su clave primaria. En el dispositivo las claves llevan la vez al
final solo si no es la 1.ª (`"semana|día|ejercicio|serie"` o `"…|serie|vez"`), así las
copias y los datos guardados antes siguen valiendo sin convertirlos. `replace_program` lee
`round` de cada serie y día completado (1 si no viene).
**Decisiones:** se descartó una tabla de «sesiones»: la vez es una propiedad de la serie y
del día completado (regla 2 de la base de datos), no tiene vida propia.
**Casos límite:** cambios que esperaban en la cola sin `round` cuentan como la 1.ª vez. El
CSV lleva una columna «Vez». `model.lastRound` se calcula de una pasada para todos los
días y se guarda hasta el siguiente cambio (Progreso lo pregunta muchas veces).
**Reglas:**
- **R1** Una clave antigua sin vez es la 1.ª vez, y la 2.ª vez se guarda aparte de la 1.ª.
  → `src/domain/workout-stats.test.ts`
- **R2** La Server Action acepta `round` de 1 a 20 y rechaza lo demás.
  → `src/app/actions/workout.test.ts`

### Días de rutina propios y calendario con varios días

**Qué hace:** guarda los nombres de los días de rutina (1–7) y, por cada uno, en qué días
de la semana se hace (ver `specs/rutina.md`).
**Cómo funciona:** `programs.day_names` (`jsonb`, día → nombre; null = los 5 de siempre)
y `programs.schedule` (`jsonb`, día → lista de días de la semana). `day` va de 1 a 7 en
`exercises`, `set_logs` y `completed_days`. Cambios nuevos: `dayNames` (añadir o renombrar:
se escribe el objeto entero) y `dayRemoved`, que llama a la función SQL
`remove_routine_day` para borrar ejercicios (con sus series en cascada), días completados,
nombre y sitio en el calendario en **una sola transacción**. `replace_program` recibe
`p_day_names`. El recordatorio diario (`due_reminders`) lee los dos formatos de `schedule`
y da el nombre del día.
**Decisiones:** `day_names` es una propiedad del programa que siempre se lee y escribe
entera, así que va en `jsonb` con `check`, como `schedule` (regla 2: no es tabla).
**Casos límite:** `schedule` antiguo (un número por día, 0 = sin día fijo) se lee igual en
la app (`normalizeSchedule`) y en SQL.
**Reglas:**
- **R3** La Server Action acepta días 1–7, nombres de 1 a 30 letras y listas de días de la
  semana (también el formato antiguo), y rechaza lo demás. → `src/app/actions/workout.test.ts`

### Borrar un entreno entero o cambiarle la fecha

**Qué hace:** quita una vez de un día de rutina en una semana (ver `specs/progreso.md`,
historial): sus series, ticks y el día completado. O lo lleva a otra fecha (y, si cae en otra
semana, a esa semana y a la primera vez libre de ese día).
**Cómo funciona:** cambio `sessionRemoved` (`week`, `day`, `round`); en Supabase, la función
SQL `remove_session` borra las filas de `set_logs` y `completed_days` de esa vez en **una
sola transacción** (security invoker: RLS solo deja tocar el programa propio). Cambio
`sessionMoved` (`week`, `day`, `round`, `toWeek`, `toRound`, `date`): la función
`move_session` cambia semana, vez y fecha de esas filas también de una vez.
**Reglas:**
- **R4** La Server Action acepta `sessionRemoved` y `sessionMoved` con semana 1–520, día
  1–7, vez 1–20 y fecha válida, y rechaza lo demás. → `src/app/actions/workout.test.ts`

## Datos

- `set_logs`: (`program_id`, `week`, `day`, `round`, `exercise_local_id`, `set_number`) →
  carga, repeticiones, nota y fecha real (`logged_on`). Serie 0 = tick manual, 1–10
  trabajo, 11–13 calentamiento.
- `completed_days`: (`program_id`, `week`, `day`, `round`).
- `programs`: `schedule` (día → días de la semana) y `day_names` (día → nombre).

## Pendiente

Nada.
