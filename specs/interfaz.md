# Interfaz

Lo común a todas las pestañas: la estructura de la app, cómo se cambia de pestaña, las
ventanas, los iconos, las letras y la hoja de estilos. Cómo se escribe el CSS (temas,
cristal líquido, mínimos de tamaño) está en `CLAUDE.md`, en "Estilos" y "Cristal líquido".

## Archivos clave

- `src/components/app-shell.tsx` — estructura (cabecera, pestaña, barra inferior, aviso
  flotante) y cambio de pestaña sin pedir la página al servidor.
- `src/components/use-tab-swipe.ts` — deslizar el dedo para cambiar de pestaña.
- `src/components/confirm-dialog.tsx` — `askConfirm` y `ConfirmDialog`.
- `src/components/icons.tsx` — todos los iconos (SVG).
- `src/app/layout.tsx` — carga la letra de los números (`--font-num`).
- `src/app/globals.css` — todos los estilos, por capas (la última manda).

## Funcionalidades

### Ventana para confirmar

**Qué hace:** antes de algo delicado (borrar, descartar, sustituir, salir de un grupo) sale
una ventana de la app con un título-pregunta, una explicación, «Cancelar» y un botón con
el nombre de la acción («Eliminar», «Borrar todo»…), en rojo si no se puede deshacer.
Tocar fuera es cancelar.
**Cómo funciona:** cualquier parte del código (también el controlador) llama a
`await askConfirm({ title, text, action, danger })`, que devuelve `true` o `false`. La
pregunta queda en un pequeño almacén del módulo y `ConfirmDialog` (montado una vez en
`AppShell`) la pinta en un portal. Si llega una pregunta nueva, la anterior se responde
con `false`.
**Decisiones:** se quitó el `confirm()` del navegador porque en una app instalada se ve
ajeno (en iPhone enseña la dirección de la web) y no se puede adaptar al tema. Por eso las
acciones que preguntan (`finishWorkout`, `deleteExercise`, `importRoutine`, `importFile`,
`clearData`) son asíncronas.
**Reglas:**
- **R1** Las confirmaciones son una ventana de la app, nunca la del navegador, y el botón
  dice la acción. → `src/components/confirm-dialog.test.tsx`, `src/components/routine-view.test.tsx`

### Iconos

**Qué hace:** todos los iconos son dibujos con el mismo trazo y toman el color del texto.
**Cómo funciona:** componentes de `icons.tsx` con la clase `ico`. Los de flecha y
tendencia tienen dirección (`ArrowIcon dir`, `TriangleIcon dir`). `GoogleIcon` es la
«G» de colores de Google, como piden sus normas de marca.
**Reglas:**
- **R2** No se usan letras ni símbolos de texto como iconos (‹ › ⌃ ✎ ✓ ＋ ↺ ↑ ↓ ▲ ▼ −).
  → `src/components/icons.test.tsx` (revisa todos los archivos de `src`)

### Títulos y etiquetas

**Qué hace:** cada pestaña lleva solo su título. En Hoy, encima, la fecha en letra normal.
Las etiquetas pequeñas no van en mayúsculas.
**Decisiones:** las etiquetas en mayúsculas sobre cada título y la numeración «01, 02»
eran adorno sin información (salía en todas las pantallas). Los códigos para compartir
siguen en mayúsculas porque lo son.
**Reglas:**
- **R3** Rutina, Progreso y Ajustes no llevan etiqueta encima del título, y la fecha de
  Hoy no va en mayúsculas. → `src/components/page-heads.test.tsx`

### Letra de los números

**Qué hace:** la carga, las repeticiones, el reloj del descanso, la tabla de series,
el anillo de Hoy y el resumen van en una letra estrecha, grande y de cifras iguales, para
leerse de un vistazo con el móvil en la mano (como el marcador de un gimnasio). El resto
usa la letra del sistema.
**Cómo funciona:** `layout.tsx` carga Barlow Condensed con `next/font/google` y la expone
como `--font-num`; Next la sirve desde la propia app, así que no hay peticiones a Google y
funciona sin internet. En el CSS, la capa «Interfaz más limpia» la aplica con
`font-variant-numeric: tabular-nums` (las cifras no bailan al cambiar).
**Reglas:**
- **R4** Los números del entreno usan `--font-num` con cifras iguales.
  → `src/components/page-heads.test.tsx`

### Hoja de estilos sin restos

**Cómo funciona:** una prueba saca todas las clases de `globals.css` y comprueba que
alguna pantalla las usa. Las que se forman al vuelo («from-» + dirección) o pone una
librería (`glass__warp`) están en su lista de excepciones.
**Reglas:**
- **R5** En el CSS no quedan clases que no use ninguna pantalla. → `src/app/styles.test.ts`

### Diseño profesional (estilo app nativa)

**Qué hace:** la app se ve como una app de iOS o Android y no como una web: fondo negro
puro, listas agrupadas de superficie plana con separadores finos (sin bordes gruesos),
título grande en cada pestaña y la raya del color del día a la izquierda allí donde sale un
día de rutina (Rutina, Hoy). El cristal solo va en **la barra de pestañas**: todo lo demás
(tarjetas, botones, campos, ventanas, la barra del descanso, «Serie hecha») es plano, con
fondo sólido, borde fino y sin brillos ni desenfoque. Ya no hay cabecera con el logo
«FITGYM»: el aviso de «Sin conexión»/«Guardando…» sale arriba solo cuando hace falta.
**Cómo funciona:** los colores son variables en `:root` (oscuro) y
`:root[data-theme="light"]`, redefinidas en la capa «Diseño profesional» al final de
`globals.css` (la última manda): `--bg`, `--s` (superficie), `--s2` (elevada), `--line`,
`--text`, `--muted`, `--accent` y `--ok` (serie hecha). Las variables `--glass*` valen
colores sólidos en `:root` (la capa «Sin cristal», al final de `globals.css`); solo `.nav`
las redefine con transparencia y desenfoque, y es el único sitio con `GlassLayer`
(`app-shell.tsx`).
**Decisiones:** inspirado en Hevy, Strong y Fitbod: se ven profesionales por ser sobrios y
densos. Antes todo era una tarjeta grande con cristal y nada destacaba; además el cristal
en muchas tarjetas a la vez pesa en el móvil. Se descartó un degradado de fondo (adorno).
Después quedaban recuadros a medias (fondo transparente con brillo en unos sí y en otros
no) y cristal en ventanas y botones flotantes: se quitó todo menos en la barra de abajo,
para que la app se vea igual en todas partes.
**Reglas:**
- **R6** El cristal (desenfoque o `GlassLayer`) solo va en la barra de pestañas.
  → `src/app/styles.test.ts`, `src/components/rest-timer.test.tsx`, `tests/e2e/mobile-ux.test.ts`
- **R7** No hay cabecera con el logo; el aviso de sincronización sale solo si hace falta.
  → `src/components/app-shell.test.tsx`

## Datos

Ninguno.

## Pendiente

Nada.
