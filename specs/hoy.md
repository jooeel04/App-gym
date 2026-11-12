# Hoy

La pestaña principal (`/entrenar`). Responde a «¿qué me toca hoy?» y es donde se anotan
las series con el móvil en la mano mientras se entrena: qué día de rutina toca, lo que
quedó pendiente de días anteriores, la lista de ejercicios y el entreno en curso.

## Archivos clave

- `src/components/training-view.tsx` — `TrainingView` (cabecera del día, pendientes,
  «Hacer otro día»), `TodayList` (lista de ejercicios desplegables), `PermissionCard`,
  `StreakPill` y `RestCard` (día de descanso). Exporta ayudas que usa el anotador:
  `supersetRole`, `suggestedWeight` y `range`.
- `src/components/exercise-logger.tsx` — `ExerciseLogger` (un ejercicio desplegado),
  `SetLogger` (fichas de las series, calentamiento, deshacer) y `SetStepper` (tarjeta de
  carga, repeticiones y nota con botones + / −).
- `src/components/dock.tsx` — hueco fijo de abajo (`DOCK_ID`, `InDock`) y «Seguir entreno»
  (`ContinueWorkout`).
- `src/components/rest-timer.tsx` — barra del descanso entre series (en el sitio del hueco).
- `src/components/day-summary.tsx` — resumen al terminar el entreno o completar el día.
- `src/controllers/workout-controller.tsx` — acciones: `setEntry`, `repeatLast`,
  `toggleExerciseChecked`, `finishWorkout`, `recoverSession`, `selectDay`, descanso
  (`startRest`, `addRest`, `stopRest`).
- `src/domain/workout-calendar.ts` — qué toca cada fecha (`sessionsOn`), días perdidos
  (`missedSessions`, últimos 14 días) y racha (`streak`).
- `src/domain/progression.ts` — consejo de progresión (`suggestNext`, doble progresión).
- `src/lib/active-workout.ts` — entreno en curso guardado en el dispositivo.

## Funcionalidades

### Entrenar en un toque (el flujo principal)

**Qué hace:** la app se usa así: entras, eliges el ejercicio, haces la serie, la apuntas y
sigues. Al abrir Hoy **ningún ejercicio está abierto**: se ve la lista entera y se toca el
que se va a hacer. Al abrirlo sale su tabla de series con la que toca lista para anotar.
Abajo, encima de la barra de pestañas y siempre en el mismo sitio (bajo el pulgar), está el
botón **«Serie hecha»**, que enseña lo que va a guardar («42,5 × 8»). Si hiciste lo
propuesto, anotar es un toque, sin bajar por la pantalla. Al pulsarlo, **ese mismo sitio
pasa a ser el descanso** (cuenta atrás, «+15 s», «Saltar») con «Deshacer» encima unos
segundos; cuando acaba el descanso vuelve «Serie hecha» para la siguiente. Al terminar las
series de un ejercicio se abre solo el siguiente, y con la última serie del día sale el
resumen. Si se cambia de pestaña a mitad de entreno, el sitio del botón dice «Seguir
entreno» y lleva de vuelta a Hoy.
**Cómo funciona:** `TodayList` empieza sin nada abierto; al tocar un ejercicio lo abre y
coloca su cabecera arriba. `SetEditor` pinta «Serie hecha» con un portal en el hueco fijo
`#dock` que pone `AppShell` (si no existe, p. ej. en una prueba suelta, lo pinta en su
sitio); el aviso de «Deshacer» de `SetLogger` va al mismo hueco. Mientras hay descanso
(`rest` del controlador) el botón no se pinta y en su lugar está `RestTimerBar`.
`ContinueWorkout` (en `AppShell`) es el botón «Seguir entreno» de las demás pestañas: sale
si hay entreno en curso, no se está en Hoy y no hay descanso. «Serie hecha» pide también
los permisos de avisos.
**Decisiones:** hubo una versión que abría sola el primer ejercicio sin terminar al entrar;
se quitó porque la persona prefiere elegir ella qué ejercicio hace (no siempre sigue el
orden). La barra de pestañas se deja como está: el botón fijo va justo encima y «Seguir
entreno» resuelve volver desde otra pestaña; ocultar las pestañas durante el entreno se
descartó porque deja a la persona sin salida a la vista.
**Casos límite:** día ya completado → nada abierto, la lista dice «Lo que hiciste»; día sin
ejercicios → aviso para añadirlos en Rutina; superserie → no hay descanso entre los dos
ejercicios enlazados, así que vuelve directamente «Serie hecha». Mientras hay algo en el hueco o
descanso en marcha, el aviso fijo de los recordatorios (`.device-card`) no sale, para no
tapar el botón; aparece al acabar o en otra pestaña.
**Reglas:**
- **R8** Al entrar en Hoy ningún ejercicio está abierto: se abre al tocarlo, con su serie
  actual lista para anotar. → `src/components/today-flow.test.tsx`
- **R9** «Serie hecha» va en el hueco fijo de abajo y dice lo que va a guardar.
  → `src/components/today-flow.test.tsx`
- **R10** Tras anotar, en ese sitio está el descanso con «Deshacer»; al saltar o acabar el
  descanso vuelve «Serie hecha». → `src/components/today-flow.test.tsx`
- **R11** En otra pestaña con un entreno en curso, «Seguir entreno» lleva a Hoy.
  → `src/components/today-flow.test.tsx`
- **R12** Músculos, foto de cómo se hace e indicaciones están plegados en «Cómo se hace»;
  el consejo de progresión sigue a la vista. → `src/components/today-flow.test.tsx`
- **R13** La tarjeta para activar los avisos va al final de la pantalla, no delante del
  ejercicio, y «Serie hecha» pide los permisos. → `src/components/training-view.test.tsx`

### Qué toca hoy

**Qué hace:** arriba sale la fecha y el título «Hoy», con la racha de semanas al lado.
Debajo, una cabecera pequeña dice qué día de rutina toca (p. ej. «Empujes»), cuántos
ejercicios y series tiene y un anillo con los ejercicios hechos (y «Terminar entreno» si
hay uno en curso). Al final de la pantalla, fuera del camino: «Hacer otro día» (con los
pendientes), la calculadora de discos y el aviso de permisos. Si hoy no toca nada, sale
«Hoy descansas» con lo que toca la próxima vez.
**Cómo funciona:** el controlador da `today`, `week` y `day`. `calendar.sessionsOn(today)`
dice qué día de rutina cae hoy según `schedule` (día de rutina → día de la semana) y la
semana del ciclo sale de `startDate`. «Hacer otro día» llama a `actions.selectDay` (el día
elegido queda en `picked` hasta «Volver a hoy»).
**Casos límite:** un día sin ejercicios dice que se añadan en Rutina; sin `startDate` no
hay racha.

### Días pendientes

**Qué hace:** si en los últimos 14 días quedó un día de rutina sin hacer, «Hacer otro día»
(al final de Hoy) avisa de cuántos hay; al abrirlo salen en «Pendientes», cada uno con
«Hacer hoy». No ocupan la parte de arriba de la pantalla.
**Cómo funciona:** `calendar.missedSessions(today)`; «Hacer hoy» llama a
`actions.recoverSession`, que lo carga como día de hoy. En Progreso ese día se marca como
«Hecho más tarde».
**Casos límite:** en un día de descanso el controlador apunta al último día de rutina de
la semana (`calendar.focusFor`); ese día no se quita de pendientes, porque no es el que
se está viendo. Así, si se salta el viernes, el sábado sale «Hacer hoy».
**Reglas:**
- **R14** En un día de descanso también sale como pendiente el último día que no se hizo.
  → `src/components/training-view.test.tsx`

### Repetir un día en la misma semana

**Qué hace:** un día de rutina se puede hacer varias veces en la misma semana. Con el día
ya hecho, debajo de la cabecera sale «Repetir este día»: abre una tanda nueva vacía (la
cabecera dice «2.ª vez esta semana») y la anterior queda guardada tal cual. En «Hacer otro
día», elegir un día que ya se hizo esta semana también abre una tanda nueva; si la última
tanda de ese día está a medias, se sigue en ella.
**Cómo funciona:** cada tanda es una «vez» (`round`, 1, 2, 3…) dentro de la semana y el
día de rutina. El controlador da `round` junto a `week` y `day`: sin elegir nada es la
última vez con algo anotado (`model.lastRound`); «Repetir este día» (`actions.repeatDay`)
y `selectDay` usan `model.openRound` (la última si está a medias, la siguiente si ya está
completada). Todo lo que se anota, marca o completa lleva su `round`. El entreno en curso
y la hora de inicio también la guardan.
**Decisiones:** se descartó guardar la repetición en otra semana (rompería las fechas y la
racha). La racha y los pendientes cuentan un día como hecho si lo está cualquiera de sus
tandas (`model.isDayDone`).
**Casos límite:** datos de antes de este cambio (y copias antiguas) son la 1.ª vez; al
volver a abrir la app sin anotar nada en la tanda nueva, se vuelve a ver la última con
datos. Como mucho 20 veces por semana (`MAX_ROUNDS`): en la 20.ª ya no sale el botón. En
Progreso → Calendario esa tanda dice «2.ª vez esa semana» (`WorkoutDiary` separa las
tandas por `round`).
**Reglas:**
- **R15** Con el día hecho, «Repetir este día» abre una tanda vacía («2.ª vez») y lo
  anotado en la primera sigue guardado. → `src/components/training-view.test.tsx`
- **R16** En «Hacer otro día», elegir un día ya hecho esta semana abre una tanda nueva.
  → `src/components/training-view.test.tsx`
- **R17** «La última vez» (lo propuesto, el consejo e «Igual que la última vez») es la
  tanda anterior, aunque sea de la misma semana. → `src/domain/workout-stats.test.ts`

### Apuntar otra fecha

**Qué hace:** en «Hacer otro día» hay un campo «Fecha» (hoy por defecto). Si se elige una
fecha pasada y luego un día de rutina, se apunta ese entreno con esa fecha: la cabecera
dice «Apuntando el martes 3 nov» y en Progreso sale en ese día del calendario. «Volver a
hoy» lo deja como estaba.
**Cómo funciona:** `actions.logPastDay(fecha, día)` guarda la fecha elegida (`logDate`
del controlador), pone la semana del ciclo de esa fecha (`calendar.cycleWeekOf`) y abre
la tanda con `model.openRound`. `setEntry`, `repeatLast` y el tick guardan esa fecha en
vez de la de hoy. Un día pasado no empieza «entreno en curso» y su resumen no tiene
duración (no tiene sentido medirla). La semana del ciclo se amplía si hace falta
(`model.ensureWeeks`).
**Casos límite:** no se puede elegir una fecha futura ni anterior a la semana 1 del ciclo
(`startDate`).
**Reglas:**
- **R18** Tras elegir una fecha pasada y un día, lo que se anota se guarda con esa fecha
  y en la semana del ciclo de esa fecha. → `src/components/training-view.test.tsx`

### Anotar las series: la tabla de series

**Qué hace:** cada ejercicio de la lista se despliega al tocarlo (solo uno abierto). Dentro
está la **tabla de series** (como en Hevy o Strong): una fila por serie con su número,
«Anterior» (lo que se hizo en esa serie la última vez), la carga, las repeticiones y un ✓.
La fila que toca está resaltada y se puede escribir en ella (carga y repeticiones, con
teclado de números); debajo, una barra fina con −/+ para la carga (2,5 kg) y las
repeticiones (1), «Discos» y «Nota». Las hechas quedan con un tinte verde. El ✓ de la fila
que toca (o «Serie hecha», abajo) la guarda; el ✓ de otra fila vacía la guarda tal cual
viene propuesta. Para corregir una serie hecha se toca su número. Es la **única** forma de
anotar.
**Cómo funciona:** `SetLogger` pinta la tabla (`SetRow` por serie) y elige la serie actual
(la primera sin repeticiones, o la que se toca). La fila actual es `SetEditor`: guarda en
su estado lo escrito y, al guardar, llama a `actions.setEntry` para la carga, la nota y
por último las repeticiones. Lo propuesto para cada serie sale de `proposal` (ver «Lo
propuesto»). Al escribir las repeticiones de una serie vacía, el controlador empieza el
descanso (salvo dentro de una superserie), comprueba el récord y marca el día como
completado si ya están todas. Cuando el ejercicio abierto queda hecho, `TodayList` abre el
siguiente que falte.
**Decisiones:** antes era una tarjeta grande con botones enormes que ocupaba media
pantalla y no dejaba ver las demás series; la tabla enseña todo de un vistazo, como las
apps de referencia. Se mantiene «Serie hecha» abajo (un toque bajo el pulgar) y los −/+,
porque con las manos sudadas es más fácil que escribir.
**Casos límite:** carga máxima 9999 kg y 999 repeticiones (avisa con un mensaje); sin
repeticiones no se puede guardar; en iPhone no vibra (la web no puede).
**Reglas:**
- **R1** Al tocar un ejercicio se despliega y muestra sus series; solo hay uno abierto y,
  al terminarlo, se abre el siguiente que falte.
- **R2** Las series se anotan solo en la tabla: no hay lista aparte ni «más opciones».
  → `src/components/exercise-logger.test.tsx`, `src/components/training-view.test.tsx`
- **R3** «Serie hecha» guarda, vibra un instante y durante 6 s ofrece «Deshacer», que
  devuelve la serie a como estaba y para el descanso. → `src/components/exercise-logger.test.tsx`
- **R20** La tabla enseña cada serie con «Anterior», carga, repeticiones y ✓; el ✓ de una
  fila vacía que no es la actual la guarda con lo propuesto. → `src/components/exercise-logger.test.tsx`

### Lo propuesto para cada serie

**Qué hace:** cada fila vacía de la tabla ya viene rellena (en gris en las que no son la
actual): la carga de la serie anterior de hoy o la de esa serie la última vez, y las
repeticiones de la última vez o el mínimo del rango objetivo. La columna «Anterior» dice
qué se hizo en esa serie la última vez.
**Cómo funciona:** `proposal` (en `SetLogger`) con `suggestedWeight` (en `training-view.tsx`) y `parseRepRange`
(dominio); «la última vez» es `stats.lastBefore(ejercicio, semana, vez)` (la tanda
anterior, ver R17).

### La lista de ejercicios, limpia

**Qué hace:** la lista de Hoy no enseña números a la derecha de cada ejercicio. Lo que se
hizo la última vez se ve al abrir el ejercicio, en la columna «Anterior» de la tabla de
series («55×8», serie a serie).
**Decisiones:** primero se pusieron todas las series a la derecha de cada fila (recargado)
y luego una línea «Última vez: …» al abrir el ejercicio; se quitó porque repetía lo que ya
dice la tabla.
**Reglas:**
- **R19** La lista no enseña series; al abrir un ejercicio, lo de la última vez está en la
  columna «Anterior». → `src/components/training-view.test.tsx`

### Calentamiento

**Qué hace:** «Añadir calentamiento» añade una ficha «Calent. 1» (hasta 3) que se anota con
los mismos botones, empieza vacía y va marcada aparte.
**Cómo funciona:** son las series 11–13 de `set_logs` (`WARMUP_SETS`). Las estadísticas y
los récords solo miran las series 1–10, así que no cuentan.
**Reglas:**
- **R4** Se añaden hasta tres series de calentamiento, se anotan igual y no cuentan como
  series de trabajo. → `src/components/exercise-logger.test.tsx`

### Notas de cada serie

**Qué hace:** «Añadir nota» abre un recuadro en la tarjeta; la nota se guarda con la serie
y vuelve a salir al tocar su ficha. En Progreso → Calendario se ve un lápiz en esa serie.
**Reglas:**
- **R5** Cada serie puede llevar una nota que se guarda al pulsar «Serie hecha».
  → `src/components/exercise-logger.test.tsx`

### Igual que la última vez

**Qué hace:** si el ejercicio se hizo antes y quedan series vacías, un botón las rellena
todas con la carga y repeticiones de aquel día.
**Cómo funciona:** `actions.repeatLast` copia solo en series vacías y de trabajo.
**Reglas:**
- **R6** «Igual que la última vez» rellena las series vacías y desaparece cuando ya no
  queda ninguna. → `src/components/exercise-logger.test.tsx`

### Marcar como hecho sin anotar

**Qué hace:** «Marcar como hecho sin anotar series» cuenta el ejercicio como hecho (por si
no se quiere apuntar nada). Con todas las series anotadas ya está hecho y no se puede
quitar la marca.
**Cómo funciona:** es la serie 0 de `set_logs` (`toggleExerciseChecked`).

### Entreno en curso y resumen

**Qué hace:** el entreno empieza solo al anotar la primera serie; la pantalla no se apaga
mientras dura. «Terminar entreno» pregunta si quedan ejercicios (o si no se anotó nada,
ofrece descartarlo) y muestra el resumen: duración, series, carga movida, repeticiones,
récords nuevos y cada ejercicio frente a la última vez.
**Cómo funciona:** `autoStart` guarda el entreno en `src/lib/active-workout.ts` y la hora
de inicio en el dispositivo. `finishWorkout` usa la ventana de confirmar de la app
(`askConfirm`). `DaySummary` lee `summary` del controlador.

### Descanso entre series

**Qué hace:** tras anotar las repeticiones sale una barra con la cuenta atrás, «+15 s» y
«Saltar». Al acabar (o unos segundos antes, según Ajustes) suena, vibra y avisa; con la
app en segundo plano llega como notificación.
**Cómo funciona:** `startRest` en el controlador; `RestTimerBar` programa los avisos y
`restFinishedAlert` hace el sonido y la vibración. La duración y el aviso se eligen en
Ajustes (`src/lib/preferences.ts`).

### Aviso para activar los permisos

**Reglas:**
- **R7** Mientras no se hayan dado los permisos, una tarjeta invita a activar los avisos;
  «Ahora no» la oculta para siempre en ese dispositivo. → `src/components/training-view.test.tsx`

## Datos

`set_logs` (series 1–10 de trabajo, 11–13 de calentamiento, 0 = marca manual del
ejercicio; cada una con carga, repeticiones, nota y fecha real) y `completed_days`. En el
dispositivo: entreno en curso, hora de inicio y «Ahora no» de los permisos.

## Pendiente

Nada.
