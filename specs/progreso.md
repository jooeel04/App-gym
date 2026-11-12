# Progreso

La pestaña Progreso (`/progreso`) responde a «¿estoy mejorando?»: un resumen en tres
números, el calendario de lo entrenado, cómo evoluciona cada ejercicio y el peso y las
medidas del cuerpo.

## Archivos clave

- `src/components/progress-view.tsx` — `ProgressView`: ordena las tarjetas de la pestaña.
- `src/components/progress-cards.tsx` — `ProgressStats` (racha, días y récords del mes) y
  `BodyCard` (peso y medidas).
- `src/components/exercise-progress.tsx` — `ExerciseProgress` (un ejercicio por fila, por
  día de rutina) y `ExerciseRow` (la fila desplegable con la última vez, el récord y la
  gráfica).
- `src/components/activity-calendar.tsx` — calendario de actividad.
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

## Datos

Ninguna tabla propia: lee `set_logs` y `body_metrics` (ver `specs/datos.md`). Todo lo de
esta pestaña se calcula.

## Pendiente

Nada.
