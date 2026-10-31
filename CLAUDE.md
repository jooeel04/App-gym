@AGENTS.md

# FitGym — guía para Claude

App web (PWA) de seguimiento del gym. Next.js 16 (App Router) + Supabase. Varias
personas la usan, cada una con su cuenta. El README tiene la arquitectura y la
lista de migraciones.

## Cómo trabajar con el usuario

- **Habla en español.** El usuario no es técnico: explica los pasos "como a un niño
  de 5 años", numerados, con los botones exactos que tiene que pulsar. Usa emojis
  con moderación y frases cortas.
- Cuando algo necesite que el usuario haga algo (Supabase, Vercel), dale el texto
  exacto para copiar y pegar. Por ejemplo, el SQL va dentro del mensaje, no solo
  como ruta a un archivo.
- Antes de decir que algo funciona, compruébalo (ver "Comprobar antes de subir").
  Si no se ha podido probar algo (p. ej. lo que depende de Supabase), dilo.

## Cómo construimos: spec → prueba → código

Todo lo que se implemente sigue este orden (SDD + TDD):

1. **Spec**: antes del código, añade o cambia las reglas en la spec del área
   (`specs/`). Cuéntale al usuario en palabras sencillas qué va a pasar y qué se va a
   probar, y espera su "vale". Ese "vale" es la confirmación de las costuras que pide
   la habilidad `tdd`.
2. **TDD** (habilidad `tdd`): una regla → una prueba en rojo → el código justo para
   pasarla → la siguiente. Nunca todas las pruebas de golpe. Se prueba por la
   interfaz pública (lo que ve el usuario o lo que llama otro módulo), no por dentro.
3. **Limpiar** con todo en verde (refactor) y pasar "Comprobar antes de subir".
4. **Cerrar la spec**: que diga lo que se ha construido de verdad, con la prueba de
   cada regla, y vaciar "Pendiente".

Si un cambio no cambia ninguna regla (un color, un margen), la spec no se toca, pero
se prueba si se puede medir (componente o e2e).

### Specs por área

Una spec por **área**, no por tarea: se actualiza la que hay y el archivo se crea la
primera vez que se toca el área. No se crean documentos fuera de esta lista sin
preguntar.

| Archivo | Qué cubre |
|---|---|
| `specs/hoy.md` | Pestaña Hoy y entreno en curso: series, descanso, progresión, resumen del día |
| `specs/rutina.md` | Plan y ejercicios, calendario semanal, asistente de cuenta nueva, compartir rutina |
| `specs/progreso.md` | Estadísticas, récords, gráficas, calendario de actividad, peso y medidas |
| `specs/ajustes.md` | Cuenta y contraseña, recordatorios, grupos y clasificación, copias y CSV, tema |
| `specs/datos.md` | Base de datos (tablas, RLS, funciones), sincronización y modo sin conexión |
| `specs/interfaz.md` | Lo común: pestañas y gestos, temas, cristal, tamaños mínimos |

Formato de cada spec:

```markdown
# <Área>
Qué es, en una o dos frases.

## Reglas
- **R1** Cuando …, entonces … → `src/…/x.test.tsx`

## Datos
Tablas y columnas que usa (o "ninguna").

## Pendiente
Lo aprobado que aún no está hecho.
```

Las reglas se escriben para que las entienda el usuario. Su número (`R1`, `R2`…) no
cambia nunca; si una regla deja de valer, se borra.

### Código (SOLID)

- **S**: una responsabilidad por archivo o clase. Si un componente calcula y además
  pinta, el cálculo va a `src/domain` y la vista se queda en `src/components`.
- **O**: para añadir algo, se añade (una entrada en una lista, una implementación
  nueva) en vez de alargar `if`/`switch` que ya existen.
- **L**: las implementaciones de un mismo contrato (p. ej. los repositorios) se
  comportan igual y pasan las mismas pruebas.
- **I**: interfaces y props pequeñas, solo con lo que se usa.
- **D**: el dominio no importa React ni Supabase; las dependencias llegan desde fuera
  (el controlador es la raíz de composición).
- Con medida (habilidad `codebase-design`): módulos profundos, con mucha lógica
  detrás de una interfaz pequeña. No crees una interfaz o abstracción con una sola
  implementación: la costura es real cuando hay dos (p. ej. la de verdad y la de
  prueba).

### Diseño de pantallas (habilidad `frontend-design`)

- Todo diseño o rediseño de interfaz usa la habilidad `frontend-design`: primero un
  plan corto (colores, tipografía, distribución y principios), se revisa contra lo
  que pide el usuario para que no sea genérico, y después se construye.
- La app es una PWA **para el móvil**: se diseña primero para el dedo (botones de
  44 px, textos de 11 px, nada que dependa del ratón ni de `:hover`), respetando
  "Estilos" y "Cristal líquido", tema oscuro y claro, `prefers-reduced-motion` y textos
  en español, sencillos y en voz activa ("Guardar cambios", no "Enviar").
- Orden: plan de diseño → "vale" del usuario → spec del área → TDD.

## "Haz deploy"

"Deploy" = commit + `git push origin main` a github.com/jooeel04/App-gym. Vercel
despliega solo desde `main` (dominio: app-gym-swart.vercel.app). No hay CLI de Vercel.

1. `git fetch` y revisa `git log HEAD..origin/main`. A veces otra persona sube
   commits: integra con rebase y conserva sus cambios.
2. Comprueba (ver abajo) y haz el commit con un mensaje en español.
3. Push. Si hay una migración nueva, avisa de que hay que ejecutarla en Supabase
   **antes**: si no, la app falla al cargar.

## Comprobar antes de subir

```bash
npm test                # Vitest: dominio y componentes (jsdom), *.test.ts(x) en src/
npm run test:e2e        # móviles reales emulados en Edge/Chrome (tests/e2e): botones ≥44 px,
                        # textos ≥11 px, nada se sale, gráficas y cristal. Necesita
                        # npm run db:start + npm run dev (cuentas demo)
npx tsc --noEmit        # los avisos de LayoutProps/PageProps son normales sin compilar
npx eslint .
npx next build          # genera también esos tipos
```

Todo en verde antes de subir (ver "Cómo construimos"). Los componentes se prueban
dentro de `WorkoutProvider` en modo local con los datos de `tests/workout-fixture.tsx`.

Sin variables de Supabase la app arranca en **modo local** (sin cuentas, datos en
localStorage), lo que permite probar la interfaz: `npx next start -p 3100`.

## Supabase

- Proyecto `tkranuxkzymppobyoiyh`. En Vercel están `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Production). `src/lib/supabase/env.ts`
  acepta esos nombres o `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`.
- No se usa la clave secreta: el servidor habla con Supabase con la **sesión de
  cada usuario** y las políticas **RLS** separan los datos.
- Las migraciones (`supabase/migrations/`) las ejecuta el usuario a mano en el
  **SQL Editor** de Supabase. Cada cambio de base de datos = archivo nuevo con
  fecha; nunca edites una migración ya aplicada.
- La recuperación de contraseña necesita `https://app-gym-swart.vercel.app/auth/confirm`
  en Authentication → URL Configuration → Redirect URLs.

### Reglas para la base de datos

- **Antes de crear una tabla**, en este orden:
  1. ¿Se puede calcular con lo que ya hay? → no se guarda.
  2. ¿Es una propiedad de algo que ya existe? → columna en esa tabla.
  3. ¿Es otra fila del mismo tipo que algo que ya existe? → fila en esa tabla (como
     el tick y el calentamiento en `set_logs`).
  4. Solo si tiene identidad y vida propias → tabla nueva, explicando por qué en
     `specs/datos.md`.
- **Normalización (3FN)**: cada dato en un solo sitio. Nada duplicado ni derivado
  (totales, récords y rachas se calculan); claves externas en vez de copiar textos.
  `jsonb` solo para datos pequeños que siempre se leen y escriben enteros (como
  `schedule`), y con `check`.
- **Integridad**: clave primaria; `references … on delete cascade` hacia el programa o
  el usuario; `not null` con `default`; `check` de rangos y longitudes; `unique` donde
  toque; tipos justos (`date`, `numeric`, `smallint`); índice en las columnas por las
  que se filtra.
- **ACID**: un cambio que toca varias filas o tablas va en **una función SQL** (una
  sola transacción) llamada con `rpc`, como `replace_program` y `remove_week`. Nunca
  varias peticiones seguidas que puedan quedarse a medias.
- **Seguridad**: RLS y políticas en toda tabla nueva; funciones `security invoker` con
  `set search_path = ''`. `security definer` solo si no hay otra forma, y explicando
  por qué en un comentario.
- **Migraciones**: archivo nuevo con fecha, repetible (`if not exists`,
  `create or replace`, `drop … if exists`) y con un comentario arriba de qué cambia y
  por qué. Si añade un dato: `replace_program` (copias), `supabase/seed.sql` (datos
  demo), la tabla del README y `specs/datos.md`.
- **Nombres**: `snake_case`, tablas en plural, claves externas en singular + `_id`
  (`program_id`).

## Claves del código

- **Pestañas**: Hoy (`/entrenar`, `TrainingView`), Rutina, Progreso, Social (todo lo de amigos) y Ajustes. `AppShell` pinta la vista según la URL; se navega con
  `history.pushState` (`switchTab` / `navigateTab` en el controlador), sin pedir la
  página al servidor. Las páginas de `src/app/(app)/*` solo devuelven `null` y el
  título. Carrusel entre pestañas (botones y gesto) en `app-shell.tsx` +
  `use-tab-swipe.ts`. Para añadir una pestaña: entrada en `NAV`, página en
  `src/app/(app)/<ruta>/page.tsx` y ruta en `APP_PAGES` de `public/sw.js`.
- **MVC**: dominio puro en `src/domain` (modelo observable, estadísticas,
  calendario, progresión); `src/controllers/workout-controller.tsx` traduce
  acciones; vistas en `src/components`.
- **Persistencia**: `ServerActionWorkoutRepository` guarda primero en el dispositivo
  (copia + cola de cambios, funciona sin internet) y envía por Server Actions
  (`src/app/actions/workout.ts`, que valida todo) a `SupabaseWorkoutRepository`.
  Cada tipo de cambio nuevo (`WorkoutChange`) necesita: modelo, validación en la
  Server Action, escritura en el repositorio de Supabase y, si es un dato nuevo,
  columna/tabla + `replace_program` (copias) en una migración.
- **Series** (`set_logs.set_number`): 0 = tick manual del ejercicio, 1–10 series de
  trabajo, 11–13 calentamiento (no cuentan en progreso ni récords).
- **Calendario**: `schedule` = día de rutina (1–5) → día de la semana (1 = lunes …
  7 = domingo, **0 = sin día fijo**). La semana del ciclo sale de `startDate`
  (lunes) y las semanas se añaden solas.
- **Estilos**: todo en `src/app/globals.css`. Colores como variables (tema oscuro en
  `:root`, claro en `:root[data-theme="light"]`). Al final hay capas que refinan lo
  anterior: "Liquid Glass" (estilo iOS 26) y "Transiciones integradas". El
  desenfoque (`backdrop-filter`) solo en elementos flotantes, por rendimiento.
  Respeta `prefers-reduced-motion`. Mínimos: textos de 11 px (`calc(11px * var(--fs))`)
  y botones de 44 px (lo comprueba `npm run test:e2e`).
- **`backdrop-filter`**: escribe solo la propiedad sin prefijo. El compilador de CSS
  (LightningCSS) **borra las dos** si van juntas `backdrop-filter` y
  `-webkit-backdrop-filter`; él ya añade el prefijo para Safari.
- **Cristal líquido** (`liquid-glass-react`): `GlassLayer` es una capa detrás del
  contenido (se carga solo en el navegador, porque lee `navigator`, y solo cerca de la
  pantalla). La barra de pestañas y la del descanso la llevan en su JSX; el resto de
  tarjetas y botones la reciben de `GlassSurfaces` (lista `GLASS_SURFACES`; para que algo
  lleve cristal, añade su selector ahí). El elemento queda marcado con `data-glass="on"`.
  Reglas: nada dentro del cristal con `mix-blend-mode` (anula el desenfoque); el elemento
  no debe tener su propio `backdrop-filter`; las capas son `span`, así que las reglas
  tipo `.tarjeta span{…}` las alcanzan (por eso se les quita el margen en el CSS).
  La pestaña que asoma al cambiar de pestaña (`.page.peek`) no lleva cristal mientras se
  desliza (atasca el movimiento): se le pone al quedarse quieta (evento `TAB_SETTLED`,
  que lanza `AppShell`), con un fundido (`.glass-layer.on`) para que no dé un destello.
- **Cambio de pestaña**: se da por terminado al acabar de verdad la transición del
  `.pager` (`afterSlide` en `use-tab-swipe.ts`), no a tiempo fijo. No uses la clase
  `peek` sola en CSS (`.peek{…}`): también la lleva la pestaña que asoma y la deforma
  durante el deslizamiento (la lista de Hoy usa `.chart.peek`).
- Comentarios, textos de la interfaz y mensajes de commit en **español**.
- Los archivos pueden tener finales de línea CRLF (Windows); normalízalos antes de
  hacer ediciones de varias líneas con scripts.
