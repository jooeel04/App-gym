# Social

La pestaña Social (`/social`) junta todo lo de los amigos: grupos con un código, la
clasificación de días entrenados del mes, quién levanta más en cada ejercicio, el apodo y
compartir rutinas. Necesita cuenta: en modo local explica cómo usarla.

## Archivos clave

- `src/components/social-view.tsx` — `SocialView`: ordena las tarjetas de la pestaña.
- `src/components/leaderboard.tsx` — tarjeta del grupo y clasificación del mes.
- `src/components/lift-ranking.tsx` — `LiftRanking`: quién levanta más en cada ejercicio.
- `src/components/share-routine.tsx` — compartir e importar rutinas.
- `src/app/actions/social.ts` — Server Actions de grupos, clasificación y récords
  (`groupExerciseRecords`).

## Funcionalidades

### Quién levanta más

**Qué hace:** una fila por ejercicio (el mismo aunque cada uno lo escriba distinto),
agrupadas por grupo muscular, con quién va primero y su peso; al lado, tu puesto y tu
peso. La marca es el día en que esa persona levantó más peso; si dos personas llegan al
mismo peso, va delante la que hizo más repeticiones en total ese día. Al tocar un
ejercicio se ve el ranking completo, solo con los pesos. Al tocar el recuadro de una
persona se despliegan las series de ese día («25×5 · 20×12 · 20×12»); al tocarlo otra
vez se pliegan.
**Cómo funciona:** la función SQL `group_exercise_records` (security definer: lee datos
de los miembros del grupo, solo si quien llama es miembro y respetando «ocultar mis
pesos») devuelve, por persona y ejercicio, la sesión (semana, día y vez) con más peso; a
igual peso, la de más repeticiones. Trae `weight`, `reps` (las de la serie más pesada),
`total_reps` y `sets` (las series de trabajo de esa sesión, en orden). `LiftRanking`
ordena por peso y luego por `total_reps`. Cada persona del ranking es un botón
(`aria-expanded`) que enseña sus series con `compactSets`.
**Decisiones:** se pidió que el máximo «cuente» también las demás series. Se mantiene el
peso como lo que manda (es lo que se compara entre amigos) y las demás series desempatan;
se descartó sumar kilos o puntuar cada serie por kg × reps. Primero las series salían en
todas las filas; se pidió que solo salgan al tocar a la persona, para que la lista no se
vea cargada.
**Casos límite:** sin series con peso, un texto explica cómo se llena; el calentamiento
(series 11–13) no cuenta.
**Reglas:**
- **R1** A igual peso va delante quien hizo más repeticiones en total ese día.
  → `src/components/lift-ranking.test.tsx`
- **R2** Las series del día de la marca solo salen al tocar el recuadro de esa persona
  en el ranking completo. → `src/components/lift-ranking.test.tsx`

## Datos

Lee `group_members`, `programs`, `exercises`, `set_logs` y `profiles` a través de
funciones SQL (ver `specs/datos.md`).

## Pendiente

Nada.
