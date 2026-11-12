# Rutina

La pestaña Rutina (`/rutina`) es el plan: qué días de rutina hay, qué ejercicios tiene
cada uno y en qué días de la semana se hacen. También el asistente de cuenta nueva y
compartir rutina.

## Archivos clave

- `src/components/routine-view.tsx` — `RoutineView`: un día de rutina por fila; con
  «Editar», añadir, renombrar y eliminar días y ejercicios.
- `src/components/day-name-modal.tsx` — ventana para poner o cambiar el nombre de un día.
- `src/components/schedule-card.tsx` — «Tu semana» (`ScheduleCard`), la ventana de cada
  día de la semana (`DaySheet`), planes rápidos y semana del ciclo.
- `src/components/exercise-modal.tsx` — añadir y editar un ejercicio.
- `src/domain/workout-model.ts` — días (`days`, `dayName`, `addDay`, `renameDay`,
  `removeDay`) y calendario (`weekdaysFor`, `setWeekdays`, `setSchedule`).
- `src/domain/workout-calendar.ts` — qué toca cada fecha (`sessionsOn`), con la vez.

## Funcionalidades

### Tus días de rutina

**Qué hace:** hay entre 1 y 7 días de rutina, cada uno con su nombre y su color. Al
empezar son los 5 de siempre (Torso, Pierna, Empujes, Tirones, Hombros y brazos). Con
«Editar» sale «Añadir día» al final de la lista: pide un nombre y crea un día vacío. Dentro
de cada día, con «Editar», están «Cambiar nombre» y «Eliminar día»; eliminar pregunta antes
porque se borran sus ejercicios y sus registros.
**Cómo funciona:** los días son los números 1–7 (`day`). Sus nombres viven en
`dayNames` del modelo (`programs.day_names` en la base de datos); si no hay, valen los 5
de siempre (`DEFAULT_DAY_NAMES`). `addDay` usa el primer número libre; `removeDay` quita el
día, sus ejercicios, series, ticks, días completados y su sitio en el calendario, y lo
guarda de una vez con la función SQL `remove_routine_day`. Cada día tiene color
`--day1`…`--day7`.
**Decisiones:** como mucho 7 (uno por día de la semana). Los nombres se guardan en el
programa (un `jsonb` pequeño que se lee y escribe entero, como `schedule`), no en una
tabla: no tienen vida propia.
**Casos límite:** no se puede borrar el último día; un nombre vacío no se guarda (máximo
30 letras).
**Reglas:**
- **R1** «Añadir día» crea un día con el nombre escrito, vacío y con su color; con 7 ya no
  sale. → `src/domain/workout-model.test.ts`, `src/components/routine-view.test.tsx`
- **R2** «Cambiar nombre» cambia el nombre del día en toda la app.
  → `src/domain/workout-model.test.ts`, `src/components/routine-view.test.tsx`
- **R3** «Eliminar día» pregunta y, al confirmar, borra el día con sus ejercicios y
  registros. → `src/domain/workout-model.test.ts`, `src/components/routine-view.test.tsx`

### Un día de rutina en varios días de la semana

**Qué hace:** en «Tu semana», al tocar un día de la semana se eligen sus rutinas; una
rutina puede estar en varios días (Torso el lunes y el jueves). En Hoy, el jueves sale
«Torso · 2.ª vez esta semana»; si el lunes no se hizo, sale en pendientes. La semana
cuenta como completa (racha) cuando se han hecho todas las veces.
**Cómo funciona:** `schedule` guarda, por día de rutina, la lista de días de la semana
(`[1, 4]`; vacía = sin día fijo). La n.ª fecha de la semana es la vez n (`round`, ver
`specs/hoy.md`): `calendar.sessionsOn` devuelve `{ semana, día, vez }` y
`plannedDate(semana, día, vez)` su fecha. Sin elegir nada, Hoy abre la vez que toca hoy (o
una posterior si ya se repitió).
**Decisiones:** antes cada día de rutina iba a un solo día de la semana y elegirlo en otro
lo movía. Los datos antiguos (un número por día) se leen como una lista de uno.
**Casos límite:** copias antiguas y el recordatorio diario aceptan los dos formatos.
**Reglas:**
- **R4** Elegir una rutina en otro día de la semana la añade sin quitarla del primero.
  → `src/components/schedule-card.test.tsx`
- **R5** Con Torso lunes y jueves, el jueves toca Torso por 2.ª vez y la semana solo está
  completa con las dos. → `src/domain/workout-calendar.test.ts`

## Datos

`exercises.day` (1–7), `programs.schedule` (`jsonb`: día → lista de días de la semana) y
`programs.day_names` (`jsonb`: día → nombre). Ver `specs/datos.md`.

## Pendiente

Nada.
