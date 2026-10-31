# Ajustes

La cuenta de cada persona (acceso, contraseña, Google, cerrar sesión), los recordatorios,
los grupos y la clasificación, las copias de datos y el tema de la app. Por ahora esta
spec documenta la **cuenta**; el resto se irá añadiendo cuando se toque.

## Archivos clave

- `src/app/login/login-form.tsx` — pantalla de acceso: Google, correo y contraseña,
  recuperar contraseña y contraseña nueva.
- `src/app/login/actions.ts` — Server Actions de correo: `authenticate` (entrar o crear
  cuenta), `requestPasswordReset`, `updatePassword`, `signOutAction`.
- `src/app/actions/account.ts` — Server Actions de Google: `signInWithGoogle`,
  `linkGoogle`, `googleStatus`.
- `src/app/auth/confirm/route.ts` — vuelta de los enlaces de los correos.
- `src/app/auth/google/route.ts` — vuelta de Google (entrar o conectar).
- `src/components/google-row.tsx` — fila «Entrar con Google» de Ajustes → Cuenta.
- `src/lib/supabase/proxy.ts` — refresca la sesión y manda a `/login` si no hay.

## Funcionalidades

### Entrar con correo y contraseña

**Qué hace:** el usuario escribe correo y contraseña y pulsa «Entrar» o «Crear cuenta».
Al crearla, si Supabase pide confirmar el correo, se le dice que revise su correo.
**Cómo funciona:** `authenticate` usa `signInWithPassword` o `signUp` con la sesión en
cookies (`createSupabaseServerClient`); el enlace del correo vuelve a `/auth/confirm`.
Los errores de Supabase se traducen a frases en español (`AUTH_ERRORS`).
**Reglas:**
- **R1** Se entra con correo y contraseña, o se crea la cuenta con los mismos datos; la
  contraseña se puede mostrar con el ojo. → `src/app/login/login-form.test.tsx`

### Recuperar o poner contraseña

**Qué hace:** «¿Olvidaste tu contraseña?» pide el correo y envía un enlace para crear una
contraseña nueva. Sirve también para que una cuenta creada con Google se ponga contraseña.
**Cómo funciona:** `requestPasswordReset` → enlace a `/auth/confirm?next=/auth/nueva-contrasena`
→ `updatePassword`.
**Decisiones:** responde siempre lo mismo, tenga o no cuenta ese correo, para no revelar
qué correos están registrados.
**Reglas:**
- **R2** La respuesta es la misma exista o no la cuenta.

### Entrar con Google

**Qué hace:** arriba en el acceso, «Continuar con Google» (blanco, con la «G» de colores);
debajo, «o con tu correo», el formulario. Al pulsarlo se abre Google, se elige la cuenta
y se vuelve a la app, a Hoy. La primera vez se crea la cuenta y sale el asistente de
cuenta nueva.
**Cómo funciona:** el botón es un formulario cuya acción es `signInWithGoogle`: pide a
Supabase la dirección de Google (`signInWithOAuth`, provider `google`, `redirectTo` =
origen + `/auth/google`) y redirige allí. Google vuelve a Supabase
(`https://<proyecto>.supabase.co/auth/v1/callback`) y Supabase a `/auth/google?code=…`.
La ruta cambia el código por la sesión (`exchangeCodeForSession`, flujo PKCE) y manda a
`/entrenar`.
**Decisiones:** ruta propia `/auth/google` en vez de reutilizar `/auth/confirm`, para
distinguir el error de Google («No se pudo entrar con Google») del de enlace caducado.
**Casos límite:** si se cancela, Google/Supabase vuelven con `?error=…` y la ruta manda a
`/login?error=google`. Si Supabase no da la dirección (Google sin activar), también.
**Reglas:**
- **R3** «Continuar con Google» va antes del formulario del correo; mientras se abre dice
  «Abriendo Google…» y no se puede pulsar otra vez. → `src/app/login/login-form.test.tsx`,
  `src/app/actions/account.test.ts`
- **R4** La vuelta abre la sesión y entra en Hoy; si se cancela o falla, vuelve al acceso
  con su propio aviso. Nunca redirige fuera de la app. → `src/app/auth/google/route.test.ts`

### No perder los datos al pasarse a Google

**Qué hace:** quien ya tenía cuenta con correo sigue viendo sus datos al entrar con
Google:
- **Mismo correo:** entra directamente en su cuenta de siempre.
- **Otro correo:** entra con su cuenta de siempre y, en Ajustes → Cuenta → «Entrar con
  Google», pulsa «Conectar con Google». Desde entonces puede entrar con los dos. La fila
  dice «Google conectado». Si ese Google ya tenía su propia cuenta en la app, avisa.
- En el acceso, una nota explica esto.
**Cómo funciona:** con el mismo correo lo hace Supabase solo (*automatic identity
linking*): enlaza la identidad de Google al usuario existente, así que el `user_id` es el
mismo y RLS le deja ver su programa de siempre. Solo lo hace si el correo de la cuenta está
**confirmado** (si no, por seguridad, no la une). Con otro correo, `linkGoogle` usa
`linkIdentity` con la sesión abierta y vuelve a `/auth/google?next=/ajustes`; la ruta manda
a `/ajustes?google=conectado|ocupado|error`. `SettingsView` abre la fila de Google si
llega ese parámetro, y `GoogleRow` enseña el resultado una vez y lo quita de la dirección.
`googleStatus` mira si el usuario ya tiene una identidad `google` (`getUserIdentities`).
**Configuración necesaria en Supabase:** provider Google activado con las claves de
Google Cloud, *Allow manual linking* activado y `https://app-gym-swart.vercel.app/auth/**`
en Redirect URLs. En local, `supabase/config.toml` lo deja preparado pero apagado.
**Casos límite:** sin *Allow manual linking* `linkGoogle` devuelve «Conectar Google aún no
está activado»; el Google de otra cuenta vuelve con `identity_already_exists` → «ocupado».
**Reglas:**
- **R5** Ajustes ofrece «Conectar con Google» si la cuenta no lo tiene, dice «Google
  conectado» si lo tiene, y avisa si falla o si ese Google ya tiene otra cuenta.
  → `src/components/google-row.test.tsx`, `src/app/auth/google/route.test.ts`

## Datos

Las cuentas e identidades las guarda Supabase Auth (`auth.users`, `auth.identities`): no
hay tablas propias para esto. Los nombres de la clasificación están en
`group_members.display_name` y los escribe cada persona al unirse a un grupo.

## Pendiente

Nada.
