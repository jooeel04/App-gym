# Progreso

La pestaña Progreso (`/progreso`) responde a «¿estoy mejorando?»: un resumen en tres
números, el calendario de lo entrenado (donde se editan, mueven y borran los entrenos), cómo evoluciona cada ejercicio y el peso y las
medidas del cuerpo.

## Archivos clave

- `src/components/progress-view.tsx` — `ProgressView`: ordena las tarjetas de la pestaña.
- `src/components/progress-cards.tsx` — `ProgressStats` (racha, días y récords del mes) y
  `BodyCard` (peso y medidas).
- `src/components/exercise-progress.tsx` — `ExerciseProgress` (un ejercicio por fila, por
  día de rutina) y `ExerciseRow` (la fila desplegable con la última vez, el récord y la
  gráfica).
- `src/components/activity-calendar.tsx` — `ActivityCalendar`: calendario de actividad; al
  tocar un día, `DayWorkout` enseña cada entreno con «Editar», «Cambiar fecha» y «Borrar entreno».
- `src/domain/workout-diary.ts` — `WorkoutDiary`: lo anotado por fecha (`days`, `activity`) y por entreno (`workouts`).
- `src/domain/workout-stats.ts` — `WorkoutStats`: sesiones de cada ejercicio
  (`session`, `exerciseHistory`), récords (`record`, `records`).
- `src/domain/progression.ts` — `progressTrend`: los puntos de la gráfica y el cambio con
  la vez anterior.

## Funcionalidades

### Tus ejercicios: peso máximo

**Qué hace:** cada ejercicio con registros es una fila. Plegada enseña **«Peso máximo»**:
lo más pesado que se levantó la última vez (p. ej. «55 kg») y cuánto cambió frente a la
vez anterior. Al tocarla se despliega con las series de la última vez, el récord y una
gráfica con el peso máximo de cada día. Los ejercicios sin carga (peso corporal) enseñan
las repeticiones de su mejor serie.
**Cómo funciona:** `stats.exerciseHistory(x)` da una sesión por cada tanda anotada
(semana y vez, ver `specs/hoy.md`), en orden. `progressTrend` toma de cada una
`topWeight` (la carga más alta de sus series de trabajo) y la serie que la consiguió.
**Decisiones:** antes se enseñaba la «fuerza» (1RM estimado con la fórmula de Epley). Se
cambió porque la persona quiere ver el peso que ha levantado de verdad, no un cálculo.
**Casos límite:** el calentamiento (series 11–13) no cuenta; un día repetido en la misma
semana es otro punto de la gráfica.
**Reglas:**
- **R1** La fila de un ejercicio con carga enseña «Peso máximo», el peso más alto de la
  última vez y el cambio con la anterior. → `src/components/exercise-progress.test.tsx`
- **R2** La gráfica enseña el peso máximo de cada día. → `src/domain/progression.test.ts`,
  `src/components/exercise-progress.test.tsx`
- **R3** Sin carga, la fila y la gráfica enseñan las repeticiones de la mejor serie.
  → `src/components/exercise-progress.test.tsx`

### Récords

**Qué hace:** el récord de un ejercicio es el día en que se levantó más peso, con todas
las series de ese día: «Récord: 25 kg · 25×5 · 20×12 · 20×12» y la fecha. Si dos días
llegan al mismo peso, gana el que tuvo más repeticiones en total. Al anotar una serie más
pesada que el récord sale «¡Nuevo récord!» con un trofeo, y el resumen de arriba cuenta
los récords conseguidos este mes. La gráfica, al tocar un punto, también enseña las
series de ese día.
**Cómo funciona:** `stats.record(x)` recorre las sesiones (`exerciseHistory`) y se queda
con la de mayor `topWeight`; a igual peso, la de más repeticiones (`reps`). Devuelve el
peso, sus series (`sets`) y el total de repeticiones. El controlador (`checkRecord`) lo
compara 1,5 s después de dejar de escribir, sin contar la propia serie.
**Decisiones:** se pidió que el máximo «cuente» también las demás series (25×5, 20×12 y
20×12 no es solo 25×5). Se descartó sumar kilos (volumen) o puntuar cada serie por
kg × reps: el peso más alto sigue mandando y las demás series desempatan y se ven. El
aviso de «¡Nuevo récord!» solo sale al subir de peso.
**Reglas:**
- **R4** «¡Nuevo récord!» sale solo al superar el peso más alto anterior.
  → `src/components/exercise-logger.test.tsx`
- **R5** El récord es el día de más peso, con todas sus series; a igual peso gana el de
  más repeticiones en total. → `src/domain/workout-stats.test.ts`,
  `src/components/exercise-progress.test.tsx`

### Calendario: ver, editar y borrar entrenos

**Qué hace:** el calendario del mes marca con un punto de color cada día entrenado. Al
tocar un día se ve debajo cada entreno de ese día: su día de rutina con **«8 series · 3120
kg»**, cada ejercicio con sus series y tres botones: **«Editar»** abre ese entreno en Hoy
(con su fecha: lo que se anote se guarda en ese día), **«Cambiar fecha»** (ver abajo) y
**«Borrar entreno»**, que pregunta y, al confirmar, lo quita entero: ya no sale en el
calendario y deja de contar como hecho (racha, pendientes, récords).
**Cómo funciona:** un entreno es una vez (`round`) de un día de rutina en una semana.
`diary.workouts()` los junta con sus series, ticks, total de series, kilos y la fecha real
más reciente; `ActivityCalendar` se queda con los de la fecha tocada y pinta uno por
`DayWorkout`. `actions.editSession` abre Hoy en esa semana, día y vez con su fecha (como
«Apuntar otra fecha»); `actions.deleteSession` pide confirmación y llama a
`model.removeSession`, que borra series, ticks y día completado de esa vez y lo guarda de
una vez (función SQL `remove_session`).
**Decisiones:** antes había además una tarjeta «Historial» (lista de entrenos con su
detalle en una ventana). Se quitó porque repetía el calendario: ahora todo se hace tocando
el día. Se borra el entreno entero (no ejercicio a ejercicio) porque lo que se quiere
quitar es lo marcado sin querer; para cambiar una serie está «Editar».
**Casos límite:** un día sin entrenos dice «Sin entrenar»; para ver entrenos antiguos se
cambia de mes con las flechas.
**Reglas:**
- **R7** «Borrar entreno» pregunta y, al confirmar, el entreno desaparece del calendario y
  deja de contar como hecho. → `src/domain/workout-model.test.ts`,
  `src/components/activity-calendar.test.tsx`
- **R8** «Editar» abre Hoy con ese entreno, y lo que se anota se guarda con su fecha.
  → `src/components/activity-calendar.test.tsx`
- **R10** Progreso no tiene «Historial»; al tocar un día del calendario, cada entreno
  enseña sus series y kilos. → `src/domain/workout-diary.test.ts`,
  `src/components/activity-calendar.test.tsx`

### Cambiar la fecha de un entreno

**Qué hace:** al tocar un día del calendario, «Cambiar fecha» de un entreno enseña ahí
mismo un campo de fecha (de la semana 1 del ciclo a hoy) con «Cancelar» y «Guardar
fecha». Al guardar, todo el entreno pasa a ese día, el calendario salta a esa fecha (y a
su mes) y cuenta para la semana de esa fecha (racha y pendientes).
**Cómo funciona:** `actions.moveSession` → `model.moveSession(semana, día, vez, fecha)`:
cambia la fecha de todas sus series y ticks. Si la fecha cae en otra semana del ciclo, el
entreno se mueve a esa semana, en la primera vez libre de ese día (`lastRound` + 1, o la 1.ª
si no hay nada), con su día completado. En Supabase lo hace la función SQL `move_session`
en una sola transacción.
**Casos límite:** no se puede elegir una fecha futura ni anterior a la semana 1 (el campo
no deja y el modelo lo ignora).
**Reglas:**
- **R9** «Cambiar fecha» mueve el entreno entero a ese día (y el calendario salta a él);
  si es de otra semana, pasa a esa semana. → `src/domain/workout-model.test.ts`,
  `src/components/activity-calendar.test.tsx`

## Datos

Ninguna tabla propia: lee `set_logs` y `body_metrics` (ver `specs/datos.md`). Todo lo de
esta pestaña se calcula.

## Pendiente

Nada.
