@AGENTS.md

# RUTINA · Seguimiento — guía para Claude

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
npx tsc --noEmit        # los avisos de LayoutProps/PageProps son normales sin compilar
npx eslint .
npx next build          # genera también esos tipos
```

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

## Claves del código

- **Pestañas**: Hoy (`/entrenar`, `TrainingView`), Rutina, Progreso y Ajustes. `AppShell` pinta la vista según la URL; se navega con
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
  Respeta `prefers-reduced-motion`.
- Comentarios, textos de la interfaz y mensajes de commit en **español**.
- Los archivos pueden tener finales de línea CRLF (Windows); normalízalos antes de
  hacer ediciones de varias líneas con scripts.
