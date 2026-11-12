# Rutina

La pestaña Rutina (`/rutina`) es el plan: qué días de rutina hay, qué ejercicios tiene
cada uno y en qué días de la semana se hacen. También el asistente de cuenta nueva y
compartir rutina.

## Archivos clave

- `src/components/routine-view.tsx` — `RoutineView`: un día de rutina por fila; dentro de
  cada día, «Editar» (solo ese día): ejercicios, color, nombre y eliminar. «Añadir día» al final.
- `src/components/day-name-modal.tsx` — ventana para poner o cambiar el nombre de un día.
- `src/components/schedule-card.tsx` — «Tu semana» (`ScheduleCard`), la ventana de cada
  día de la semana (`DaySheet`), planes rápidos y semana del ciclo.
- `src/components/exercise-modal.tsx` — añadir y editar un ejercicio.
- `src/domain/day-colors.ts` — los 8 colores que se pueden elegir (`DAY_COLORS`) y el de
  cada día por defecto.
- `src/components/day-color-style.tsx` — `DayColorStyle`: pinta `--day1`…`--day7` con el
  color elegido de cada día.
- `src/domain/workout-model.ts` — días (`days`, `dayName`, `dayColor`, `addDay`, `renameDay`,
  `setDayColor`, `removeDay`) y calendario (`weekdaysFor`, `setWeekdays`, `setSchedule`).
- `src/domain/workout-calendar.ts` — qué toca cada fecha (`sessionsOn`), con la vez.

## Funcionalidades

### Tus días de rutina

**Qué hace:** hay entre 1 y 7 días de rutina, cada uno con su nombre y su color. Al
empezar son los 5 de siempre (Torso, Pierna, Empujes, Tirones, Hombros y brazos). Al final
de la lista siempre está «Añadir día»: pide un nombre y crea un día vacío. Al tocar un día
se abre su recuadro con sus ejercicios y, abajo, «Hacer … hoy» y **«Editar»**. «Editar»
pone en modo editar **solo ese día, dentro de su recuadro**: sus ejercicios con Editar,
Eliminar y subir/bajar, «Añadir ejercicio», **«Color»** (8 círculos; al tocar uno el día
cambia de color en toda la app), «Cambiar nombre», «Eliminar día» y «Listo» para salir.
Eliminar pregunta antes porque se borran sus ejercicios y sus registros.
**Cómo funciona:** los días son los números 1–7 (`day`). Sus nombres viven en
`dayNames` del modelo (`programs.day_names` en la base de datos); si no hay, valen los 5
de siempre (`DEFAULT_DAY_NAMES`). `addDay` usa el primer número libre; `removeDay` quita el
día, sus ejercicios, series, ticks, días completados y su sitio en el calendario, y lo
guarda de una vez con la función SQL `remove_routine_day`. Cada día tiene un color de
`DAY_COLORS` (azul, naranja, verde, amarillo, rosa, morado, turquesa, rojo); el elegido vive
en `dayColors` (`programs.day_colors`) y, sin elegir, vale el de siempre de su número
(`defaultDayColor`). `DayColorStyle` (en `src/app/(app)/layout.tsx`) escribe `--dayN: var(--c-<color>)`
en `:root`, así que todo lo que usa `--dayN` cambia solo. Los colores `--c-*` tienen su
versión para tema oscuro y claro. `RoutineView` guarda qué día está abierto y cuál se está
editando (solo uno).
**Decisiones:** antes había un «Editar» arriba, junto al título, que ponía en modo editar
todos los días a la vez: se pasó dentro de cada día para editar justo el que se toca.
Colores de una lista fija y no una rueda libre, para que siempre se lean bien en los dos
temas. Las marcas de «hecho» usan `--ok`, no el color de un día, para que no cambien al
cambiar ese color. Como mucho 7 (uno por día de la semana). Los nombres se guardan en el
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
- **R6** No hay «Editar» arriba: al abrir un día, su «Editar» está dentro del recuadro y
  solo pone en modo editar ese día; «Listo» lo cierra. «Añadir día» está siempre al final.
  → `src/components/routine-view.test.tsx`
- **R7** Elegir un color en «Color» cambia el color del día (`--dayN`) y se guarda.
  → `src/domain/workout-model.test.ts`, `src/components/routine-view.test.tsx`

### Un día de rutina en varios días de la semana

**Qué hace:** en «Tu semana», al tocar un día de la semana se eligen sus rutinas; una
rutina puede estar en varios días (Torso el lunes y el jueves). En Hoy, el jueves sale
«Torso · 2.ª vez esta semana»; si el lunes no se hizo, sale en pendientes. La semana
cuenta para la racha cuando se han hecho tantos entrenos como veces pide el plan (ver
`specs/hoy.md`, R30).
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
- **R5** Con Torso lunes y jueves, el jueves toca Torso por 2.ª vez: cuenta como un entreno
  más del plan de la semana y, si no se hace, sale en pendientes. → `src/domain/workout-calendar.test.ts`

## Datos

`exercises.day` (1–7), `programs.schedule` (`jsonb`: día → lista de días de la semana) y
`programs.day_names` (`jsonb`: día → nombre) y `programs.day_colors` (`jsonb`: día →
color). Ver `specs/datos.md`.

## Pendiente

Nada.
