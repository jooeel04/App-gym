# Hoy

La pestaña principal (`/entrenar`). Responde a «¿qué me toca hoy?» y es donde se anotan
las series con el móvil en la mano mientras se entrena: qué día de rutina toca, lo que
quedó pendiente de días anteriores, la lista de ejercicios y el entreno en curso.

## Archivos clave

- `src/components/training-view.tsx` — `TrainingView` (cabecera del día, pendientes,
  fila «Hoy · Repetir»), `TodayList` (lista de ejercicios desplegables), `PermissionCard`,
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
- `src/domain/equipment.ts` — con qué se hace cada ejercicio (`equipmentOf`, por el nombre) y
  el peso siguiente o anterior que existe con ese material (`nextLoad`).
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
hay uno en curso). Debajo, la lista de ejercicios con su título, «Lo que vas a hacer»
(«Lo que hiciste» con el día hecho). Debajo de la lista, **una fila de botones
iguales**, a la misma altura, cuando hacen falta: **«Hoy»** (vuelve a lo de hoy; solo si
se eligió otro día) y **«Repetir»** (solo con el día hecho). Si hay uno ocupa todo el
ancho; si hay dos, se reparten. Elegir otro día se hace tocando un día de «Esta semana»
(ver «Tu semana…»). Al final solo queda el aviso de permisos. Si hoy
no toca nada, sale «Hoy descansas» con lo que toca la próxima vez.
**Cómo funciona:** el controlador da `today`, `week` y `day`. `calendar.sessionsOn(today)`
dice qué día de rutina cae hoy según `schedule` (día de rutina → día de la semana) y la
semana del ciclo sale de `startDate`. Elegir un día en «Esta semana» llama a
`actions.selectDay` (el día elegido queda en `picked` hasta «Hoy», `actions.goToToday`). La fila es `.today-actions` en
`TrainingView`; cada botón tiene un nombre completo para el lector de pantalla («Volver a
hoy», «Repetir este día»).
**Decisiones:** antes «Volver a hoy» y «Repetir este día» iban arriba como enlaces y «Hacer
otro día» al final, debajo de la lista (luego la fila estuvo un tiempo bajo la cabecera, pero
se prefirió ver primero los ejercicios), junto a una tarjeta grande de la calculadora de
discos. Se juntaron en una fila con textos cortos para que Hoy quede limpio; la
calculadora pasó a Ajustes → Calculadora de discos, donde ya se eligen la barra y los
discos. Después «Otro día» (con su panel de pendientes, fecha y días) pasó a la tira «Esta
semana»: se elige tocando el día.
**Casos límite:** un día sin ejercicios dice que se añadan en Rutina; sin `startDate` no
hay racha.
**Reglas:**
- **R27** «Hoy» y «Repetir» van en la misma fila, debajo de la lista de ejercicios; no hay
  botón «Otro día».
  → `src/components/training-view.test.tsx`
- **R28** Hoy no tiene calculadora de discos (está en Ajustes). → `src/components/training-view.test.tsx`

### Tu semana (con «Otro día»), «Hoy puedes subir» y la frase del día

**Qué hace:** para que Hoy diga algo útil antes de empezar:
- **La frase del día**, debajo de la fecha, centrada y en una sola línea (15 px, 38 letras
  como mucho): para animar. Sale una **al azar cada vez que se abre la app** (así cada
  persona ve una distinta) y nunca la misma que la vez anterior en ese móvil.
- **Esta semana**, encima de la tarjeta del día: una tira con los 7 días (L…D). Relleno con
  el color de la rutina si ese día se entrenó; con borde si tocaba y falta; un punto gris si
  es de descanso. Hoy va marcado. En días de descanso también sale. A la derecha, «2 de 5»
  (entrenos hechos de los que pide el plan), la racha y, si los hay, «N pendientes».
  **Cada día es un botón**: al tocarlo se abre debajo un panel con ese día (otra vez, se
  cierra): si se entrenó, «Editar Torso» (lo abre como en el calendario); si es pasado y
  falta, «Hacer Tirones hoy» (lo recupera); si es hoy o de los que vienen, «Hacer Pierna
  hoy»; siempre, «Otra rutina» con todas las rutinas (en un día pasado se apunta con esa
  fecha; si no, se hace hoy) y «Otra fecha…» (campo de fecha para otras semanas). Es lo que
  antes estaba en «Otro día».
- **Hoy puedes subir peso** (solo si hay algo), entre la tarjeta del día y la lista: los
  ejercicios de hoy aún sin hacer en los que el consejo es subir, con «60 → 62,5 kg», como
  mucho 3. Al tocar uno se abre en la lista.
**Cómo funciona:** `randomQuote(azar, anterior)` (`src/domain/daily-quote.ts`) elige una de
la lista fija que no sea la anterior. `DailyQuote` la elige una vez por cada apertura de la
app (se queda igual al cambiar de pestaña) y guarda en el dispositivo cuál salió
(`rutina:quote`) para no repetirla la próxima vez. `weekStrip(hoy,
calendar, diary)` (`src/domain/week-strip.ts`) da los 7 días con lo previsto
(`calendar.sessionsOn`) y lo hecho (`diary.activity`). `raiseTargets` (en
`progression.ts`) usa `suggestNext` (con los saltos por material) y se queda con los de
tipo «subir». `TrainingView` pinta `DailyQuote`, `RaiseCard` (`today-extras.tsx`) y
`WeekPlanner` (`week-planner.tsx`: la tira, el panel del día y los pendientes, con
`actions.editSession`, `recoverSession`, `selectDay` y `logPastDay`); al tocar una fila pide a `TodayList` que abra ese ejercicio
(`openRequest`).
**Decisiones:** hubo un recuadro «La última vez» (fecha, carga y kcal del entreno anterior
de ese día); se quitó porque no ayudaba mucho. Se descartaron fotos: llenan pero no ayudan
a entrenar. Las frases son propias, cortas, en segunda persona y sin culpa («mejor una
serie más que ninguna»), no citas de famosos.
**Reglas:**
- **R33** «Esta semana» va encima de la tarjeta del día y enseña los 7 días con su estado
  (hecho, falta, descanso), hoy marcado, y «X de Y». → `src/domain/week-strip.test.ts`,
  `src/components/training-view.test.tsx`
- **R37** Al tocar un día de «Esta semana» se abre su panel: «Editar» si se entrenó,
  «Hacer … hoy» si tocaba (pasado: lo recupera), y siempre «Otra rutina» (en un día pasado,
  con esa fecha) y «Otra fecha…». → `src/components/training-view.test.tsx`
- **R34** «Hoy puedes subir peso» lista solo los ejercicios de hoy sin hacer con consejo de
  subir (máx. 3) y al tocar uno se abre; si no hay ninguno, no sale.
  → `src/domain/progression.test.ts`, `src/components/training-view.test.tsx`
- **R35** La frase sale al azar al abrir la app, no repite la de la vez anterior, se queda
  igual mientras la app está abierta y cabe en una línea (38 letras como mucho).
  → `src/domain/daily-quote.test.ts`

### Racha de semanas

**Qué hace:** arriba de Hoy, la llama dice cuántas semanas seguidas llevas yendo al gym
lo que pide tu plan; en un día de descanso, «Llevas 2 de 5 días esta semana». Una semana
cuenta si haces **tantos entrenos como días tiene tu plan** esa semana (5 días en el
calendario → 5 entrenos), **sean de la rutina que sean**: repetir Torso y saltarte Pierna
también vale. La semana en curso no rompe la racha hasta que acaba: descansar el lunes no
la pierde si al llegar el domingo has hecho los 5; en cuanto los haces, suma +1.
**Cómo funciona:** `calendar.streak(hoy)`: el plan son las veces que pide el calendario
por semana (`slots`: cada día de rutina con ejercicios, tantas veces como días de la
semana tiene). Los entrenos hechos de una semana son todas sus tandas (cualquier día y
`round`) completas o con series anotadas (`isDone`). La semana está completa si hechos ≥
plan. «Llevas X de Y» no pasa de Y.
**Decisiones:** antes había que hacer cada día de la rutina al menos una vez: alguien que
fue 6 días pero repitió Hombros en vez de Pierna perdía la racha. Se eligió premiar la
constancia (ir al gym); lo que falta por hacer ya lo recuerda «Pendientes».
**Casos límite:** sin días en el calendario no hay racha; los días «sin día fijo» no
suman al plan, pero si se hacen sí cuentan como entreno.
**Reglas:**
- **R30** La semana cuenta para la racha con tantos entrenos como días tiene el plan,
  aunque sean repeticiones de otro día; la semana en curso no la rompe hasta que acaba.
  → `src/domain/workout-calendar.test.ts`

### Días pendientes

**Qué hace:** si en los últimos 14 días quedó un día de rutina sin hacer, «Esta semana»
lo avisa con un botón «N pendientes» en su cabecera; al tocarlo salen en «Pendientes» (los
de la semana pasada también), cada uno con «Hacer hoy». Los de esta semana además se ven
en la tira (con borde) y al tocar su día sale «Hacer … hoy».
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
ya hecho, debajo de la lista sale «Repetir»: abre una tanda nueva vacía (la
cabecera dice «2.ª vez esta semana») y la anterior queda guardada tal cual. En «Otro
día», elegir un día que ya se hizo esta semana también abre una tanda nueva; si la última
tanda de ese día está a medias, se sigue en ella.
**Cómo funciona:** cada tanda es una «vez» (`round`, 1, 2, 3…) dentro de la semana y el
día de rutina. El controlador da `round` junto a `week` y `day`: sin elegir nada es la
última vez con algo anotado (`model.lastRound`); «Repetir este día» (`actions.repeatDay`)
y `selectDay` usan `model.openRound` (la última si está a medias, la siguiente si ya está
completada). Todo lo que se anota, marca o completa lleva su `round`. El entreno en curso
y la hora de inicio también la guardan.
**Decisiones:** se descartó guardar la repetición en otra semana (rompería las fechas y la
racha). Los pendientes cuentan un día como hecho si lo está cualquiera de sus tandas
(`model.isDayDone`); la racha cuenta cada tanda como un entreno (ver «Racha de semanas»).
**Casos límite:** datos de antes de este cambio (y copias antiguas) son la 1.ª vez; al
volver a abrir la app sin anotar nada en la tanda nueva, se vuelve a ver la última con
datos. Como mucho 20 veces por semana (`MAX_ROUNDS`): en la 20.ª ya no sale el botón. En
Progreso → Calendario esa tanda dice «2.ª vez esa semana» (`WorkoutDiary` separa las
tandas por `round`).
**Reglas:**
- **R15** Con el día hecho, «Repetir este día» abre una tanda vacía («2.ª vez») y lo
  anotado en la primera sigue guardado. → `src/components/training-view.test.tsx`
- **R16** En «Esta semana», elegir un día de rutina ya hecho esta semana abre una tanda
  nueva.
  → `src/components/training-view.test.tsx`
- **R17** «La última vez» (lo propuesto, el consejo e «Igual que la última vez») es la
  tanda anterior, aunque sea de la misma semana. → `src/domain/workout-stats.test.ts`

### Apuntar otra fecha

**Qué hace:** al tocar un día pasado en «Esta semana» y elegir una rutina en «Otra rutina»,
o con «Otra fecha…» (un campo de fecha, para otras semanas) y luego una rutina, se apunta
ese entreno con esa fecha: la cabecera
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
- **R18** Tras elegir una fecha pasada (en la tira o con «Otra fecha…») y una rutina, lo que se anota se guarda con esa fecha
  y en la semana del ciclo de esa fecha. → `src/components/training-view.test.tsx`

### Anotar las series: la tabla de series

**Qué hace:** cada ejercicio de la lista se despliega al tocarlo (solo uno abierto). Dentro
está la **tabla de series** (como en Hevy o Strong): una fila por serie con su número,
«Anterior» (lo que se hizo en esa serie la última vez), la carga, las repeticiones y un ✓.
La fila que toca está resaltada y se puede escribir en ella (carga y repeticiones, con
teclado de números); debajo, una barra fina con −/+ para la carga (según el material, ver
«Saltos de peso») y las
repeticiones (1) y «Nota». Las hechas quedan con un tinte verde. El ✓ de la fila
que toca (o «Serie hecha», abajo) la guarda; el ✓ de otra fila vacía la guarda tal cual
viene propuesta. Para corregir una serie hecha se toca **cualquier parte de su fila**
(número, carga, repeticiones o ✓): se abre con sus números y abajo sale «Guardar cambios».
Es la **única** forma de anotar.
**Cómo funciona:** `SetLogger` pinta la tabla (`SetRow` por serie) y elige la serie actual
(la primera sin repeticiones, o la que se toca). En una serie hecha, `SetRow` pinta la fila
entera como un botón (con su ✓ verde dentro), que la hace la actual. La fila actual es `SetEditor`: guarda en
su estado lo escrito y, al guardar, llama a `actions.setEntry` para la carga, la nota y
por último las repeticiones. Lo propuesto para cada serie sale de `proposal` (ver «Lo
propuesto»). Al escribir las repeticiones de una serie vacía, el controlador empieza el
descanso (salvo dentro de una superserie), comprueba el récord y marca el día como
completado si ya están todas. Cuando el ejercicio abierto queda hecho, `TodayList` abre el
siguiente que falte.
**Decisiones:** antes era una tarjeta grande con botones enormes que ocupaba media
pantalla y no dejaba ver las demás series; la tabla enseña todo de un vistazo, como las
apps de referencia. Se mantiene «Serie hecha» abajo (un toque bajo el pulgar) y los −/+,
porque con las manos sudadas es más fácil que escribir. Antes una serie hecha solo se
podía abrir tocando su número, y el ✓ verde no hacía nada: la gente tocaba el ✓ y creía
que no se podía cambiar. «Discos» se quitó de la fila porque estorbaba; la calculadora
sigue al final de Hoy.
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
- **R21** Al tocar una serie hecha (también su ✓ verde) se abre para cambiarla con sus
  números, y «Guardar cambios» guarda lo nuevo. → `src/components/exercise-logger.test.tsx`
- **R22** La fila que se escribe no tiene botón «Discos» (la calculadora sigue al final de
  Hoy). → `src/components/exercise-logger.test.tsx`

### Saltos de peso según el material

**Qué hace:** el consejo («Sube a 18 kg…») y los botones −/+ de kg solo proponen pesos que
existen en el gimnasio. Con mancuernas sube de 2 en 2 (16 → 18, nunca 17,5); en polea y
máquinas de placas, de 2,5 en 2,5; con barra, el doble del disco más pequeño de tu gym; con
kettlebell, de 4 en 4.
**Cómo funciona:** `equipmentOf(nombre)` mira el nombre del ejercicio (sin mayúsculas ni
tildes) y lo clasifica con una lista de palabras: «mancuerna», «goblet», «arnold»,
«búlgara», «zancada», «patada de tríceps», «elevaciones frontales» → mancuernas;
«kettlebell», «pesa rusa» → kettlebell; «barra» (salvo «barra fija»), «multipower»,
«smith», «peso muerto», «press cerrado», «remo en T» → barra o discos; lo demás → máquina
de placas. `nextLoad(nombre, peso, ±1, discoMásPequeño)` da el peso siguiente o anterior:
mancuernas (4–60) y kettlebells (4–48) son una escala fija; en barra y máquina se suma o
resta el salto a lo apuntado, porque la barra o la torre pueden empezar en un número
cualquiera (una barra Z de 7 kg, una polea que empieza en 1,25). `suggestNext` lo usa para «Sube a…» y `SetEditor` para −/+; el disco más
pequeño sale de Ajustes → Calculadora de discos (`getPlatePrefs`).
**Decisiones:** las escalas salen de Fitness Park: mancuernas de 4 a 60 kg (de 2 en 2,
visto en sala), máquinas Technogym con placas de 5 kg y una placa de 2,5 kg integrada, y
discos Eleiko (el más pequeño, 1,25 kg). Antes subía +1 kg por debajo de 20 kg y +2,5 por
encima, para todo, y proponía mancuernas que no existen. Se clasifica por el nombre para no
añadir una columna nueva y para que funcione también con los ejercicios propios.
Los −/+ se llaman «Subir peso» / «Bajar peso», porque el salto ya no es siempre 2,5 kg.
**Casos límite:** un peso que no está en la escala (15 kg en mancuernas) sube al siguiente
que sí está (16) y baja al anterior (14); las mancuernas no bajan de 4 ni suben de 60 y,
en 60, el consejo dice que se mantenga el peso; ninguna escala baja de 0. Un ejercicio
con un nombre que no dice el material cuenta como máquina (2,5 kg).
**Reglas:**
- **R23** Con mancuernas el consejo sube de 2 en 2 kg (16 → 18). → `src/domain/progression.test.ts`
- **R24** En polea o máquina sube de 2,5 en 2,5 kg (16 → 18,5); con barra, el doble del
  disco más pequeño (60 → 62,5 con discos de 1,25). → `src/domain/progression.test.ts`
- **R25** Un peso fuera de la escala va al siguiente que existe (15 → 16 en mancuernas), y
  las mancuernas no bajan de 4 kg. → `src/domain/equipment.test.ts`
- **R26** Los −/+ de kg usan el mismo salto que el consejo (mancuernas 16 → 18).
  → `src/components/exercise-logger.test.tsx`

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

### Calorías del entreno (estimación)

**Qué hace:** el resumen del entreno dice cuántas calorías se gastaron, aproximadas
(«≈ 320 kcal»), y debajo lo de cada ejercicio. Sin peso corporal apuntado, en vez del número
dice «Apunta tu peso en Progreso para ver las calorías».
**Cómo funciona:** `src/domain/energy.ts`. Cada ejercicio tiene un MET según cuánto
músculo mueve, sacado de su nombre con una lista de palabras (`intensityOf`): grandes
(sentadilla, peso muerto, hip thrust, prensa, zancadas…) 6; aislados (curl, extensión,
elevaciones, aperturas, gemelos, abdominales…) 3,5; el resto (press, remo, dominadas…) 5.
Tiempo de cada serie de trabajo = 40 s + el descanso elegido en Ajustes (90 s si está
apagado). kcal = MET × peso (kg) × horas (`estimateKcal`). Cuentan las series de trabajo
con repeticiones; un ejercicio marcado con el tick sin series cuenta sus series previstas.
El calentamiento no cuenta. El peso es el último apuntado en Progreso (`latestBodyWeight`).
**Decisiones:** los METs son la forma estándar de estimar sin pulsómetro (Compendium of
Physical Activities: pesas moderadas 3,5, vigorosas 6). Se enseña con «≈» porque puede
fallar un 30 %. Sin peso no se inventa uno.
**Reglas:**
- **R31** El resumen enseña «≈ N kcal» del entreno y de cada ejercicio; más series o más
  peso corporal dan más, y un ejercicio grande gasta más que uno aislado con las mismas
  series. Sin peso, pide apuntarlo. → `src/domain/energy.test.ts`, `src/components/day-summary.test.tsx`

### Calorías del reloj (apuntadas a mano)

**Qué hace:** quien lo activa en Ajustes → Calorías («Apuntar las kcal del reloj») ve en
el resumen del entreno un campo «kcal del reloj» y «Guardar». Con un número guardado, el
resumen enseña **«320 kcal ⌚»** (sin «≈») y debajo, en pequeño, la estimación. Las kcal
del reloj son de la **fecha** del entreno (las del día, como las cuenta el reloj).
**Cómo funciona:** `model.watchKcal(fecha)` / `setWatchKcal(fecha, kcal | null)` (cambio
`watchKcal`, tabla `watch_energy`). El resumen sabe su fecha (`summary.date`: hoy o la
fecha elegida al apuntar otro día). La preferencia es del dispositivo
(`getEnergyPrefs` en `src/lib/preferences.ts`).
**Decisiones:** por fecha y no por entreno: el reloj cuenta por día y así el atajo de
iPhone solo tiene que mandar «fecha + kcal». Si un día hay dos entrenos, comparten las kcal
del reloj.
**Casos límite:** de 1 a 9999 kcal; vacío borra lo apuntado.
**Reglas:**
- **R32** Con «Apuntar las kcal del reloj» activado, el resumen tiene el campo; al guardar
  enseña «N kcal ⌚» en vez de la estimación. Desactivado, no sale el campo.
  → `src/components/day-summary.test.tsx`, `src/domain/workout-model.test.ts`

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
