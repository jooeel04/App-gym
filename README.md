# FitGym

App web progresiva, adaptada a móvil, creada a partir de las pestañas Resumen, Rutina y Registro del Excel. Las semanas se añaden solas según avanza el calendario.

Varias personas, cada una con su cuenta (correo y contraseña) y sus propios datos. **Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth).

## Incluye
- Plan con cinco días y las indicaciones de cada ejercicio; el número de semanas es ajustable.
- Añadir ejercicios por día con series, objetivo de repeticiones y detalle técnico; eliminar ejercicios cuando ya no se necesiten.
- Registro por serie de carga, repeticiones y nota; conserva las series opcionales.
- Calendario: cada día de la rutina se asigna a un día de la semana (L–D), con presets y fecha de inicio del ciclo.
- Hoy (pestaña principal): lo que toca hoy con un botón grande para empezar, los días de las últimas dos semanas que quedaron sin hacer («Hacer hoy»), los días de descanso y «Hacer otro día»; «Corregir series» abre la lista editable.
- Asistente para cuentas nuevas (sin datos): qué días entrena, qué rutina quiere (recomendada, la de un amigo o vacía) y cómo queda la semana.
- Calendario en Progreso: al tocar un día se ve lo entrenado esa fecha (ejercicios y series), marcando los días recuperados.
- Cuentas con correo y contraseña: los datos de cada persona se guardan en su cuenta y los ve en cualquier dispositivo donde inicie sesión.
- Resumen por semana y día, historial de cargas y exportación a CSV.
- Copia y restauración de datos en JSON.
- Al entrenar: peso y repeticiones propuestos en cada serie (de la serie anterior o de la última vez; con escribir solo las repeticiones basta) y botón "Igual que la última vez", temporizador de descanso, sugerencia de progresión (doble progresión), récords personales, series de calentamiento, superseries, calculadora de discos y resumen al completar el día (con la comparación de cada ejercicio frente a la última vez).
- Entreno en curso: botón "Empezar entreno" (o empieza solo al anotar la primera serie) que abre una pantalla completa con un ejercicio cada vez (avanza solo al terminarlo, flechas y barra de pasos para moverse), barra flotante con el tiempo y los ejercicios hechos al minimizarla, la pantalla no se apaga y "Terminar" muestra el resumen.
- Progreso: racha de semanas, fuerza (1RM estimado) y récord de cada ejercicio, peso corporal y medidas.
- Social (pestaña propia): grupos de amigos con un código, clasificación de días entrenados del mes, quién levanta más en cada ejercicio (de un vistazo) y compartir o importar rutinas.
- Recuperación de contraseña por correo.
- Instalación en pantalla de inicio (PWA) y uso sin conexión: los cambios se guardan en el dispositivo y se envían a la cuenta al volver internet.

## Puesta en marcha

### 1. Base de datos (Supabase)
En el SQL Editor del proyecto, ejecuta en orden los archivos de `supabase/migrations/`:
1. `20261028000000_init_workout_schema.sql`
2. `20261029000000_single_owner_mode.sql`
3. `20261030000000_schedule_and_daily_log.sql`
4. `20261031000000_exercise_checks.sql`
5. `20261101000000_multi_user_accounts.sql`
6. `20261102000000_allow_exercise_check_rows.sql`
7. `20261103000000_gym_features.sql`
8. `20261104000000_daily_reminders.sql` (recordatorio diario; la clave privada VAPID se guarda aparte)
9. `20261105000000_reliable_reminders.sql` (el aviso solo se marca como enviado si llega; si no, se reintenta)
10. `20261106000000_nicknames_and_lift_ranking.sql` (apodo de cada persona y quién levanta más en cada ejercicio)

En Authentication → URL Configuration, añade `https://tu-dominio/auth/confirm` (y `http://localhost:3000/auth/confirm`) a las Redirect URLs: es el enlace del correo de confirmación de cuenta.

### 2. Variables de entorno
En Vercel → Settings → Environment Variables (Production y Preview), o en `.env.local` para desarrollo:

| Variable | Dónde está |
|---|---|
| `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`) | Supabase → Project Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Supabase → Project Settings → API Keys → Publishable key (`sb_publishable_…`) o `anon` |

Después de añadirlas o cambiarlas en Vercel, vuelve a desplegar.

Sin estas variables la app arranca en **modo local**: sin cuentas, datos solo en el navegador.

Los datos de la versión sin login (programa sin dueño) pasan a la **primera cuenta que inicia sesión**. Las cuentas siguientes empiezan con la rutina base.

### 3. Desarrollo
```bash
npm install
npm run dev   # http://localhost:3000
```

### 4. Base de datos local con datos demo (Docker)
Necesita [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto. La CLI de
Supabase (`supabase/config.toml`) levanta Postgres, Auth y Studio en contenedores, aplica
`supabase/migrations/` y carga `supabase/seed.sql`: un año de entrenos demo con fechas hasta hoy.

```bash
npm run db:start    # arranca los contenedores (la primera vez descarga las imágenes)
npm run db:reset    # borra la base local y vuelve a cargar migraciones y datos demo
npm run db:stop     # apaga los contenedores (los datos se conservan)
```

Copia en `.env.local` la URL y la clave que muestra `npm run db:status`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Cuentas demo (contraseña `demo1234`): `demo@rutina.local` (52 semanas), `ana@rutina.local`
(40 semanas) y `leo@rutina.local` (26 semanas, 3 días por semana), en el grupo `DEMO01`.
Studio (ver las tablas): http://127.0.0.1:54323 · Correos de prueba: http://127.0.0.1:54324

### 5. Pruebas

```bash
npm test             # dominio y componentes (Vitest + Testing Library, sin servidor)
npm run test:e2e     # en móviles emulados con Edge/Chrome; necesita npm run db:start y npm run dev
```

Las pruebas en móvil comprueban, en tamaños de 320 px a tablet (vertical y horizontal),
que nada se sale de la pantalla, que los botones miden al menos 44 px y los textos 11 px,
que las gráficas se deslizan con el dedo y que la barra de pestañas lleva el cristal
líquido. Si no encuentran el navegador, indica su ruta en `BROWSER_PATH`.

## Arquitectura (MVC + SOLID)

```
src/
  domain/                 Model: reglas de negocio puras (sin React ni Supabase)
    types.ts              Tipos del dominio y de los cambios (WorkoutChange)
    snapshot.ts           Formato del estado, claves y validación
    workout-model.ts      Modelo observable: rutina, series, semanas, días completados
    workout-stats.ts      Estadísticas e historial de cargas (solo lectura)
    workout-calendar.ts   Fechas planificadas, qué toca hoy y días pendientes
    workout-diary.ts      Registro diario agrupado por fecha
    calendar.ts           Utilidades de fechas (YYYY-MM-DD, días de la semana)
    backup-service.ts     Copia JSON y exportación CSV
    base-routine.ts       Rutina base del Excel
  repositories/           Persistencia detrás de una interfaz
    workout-repository.ts               Contrato que usa el modelo
    server-action-workout-repository.ts Navegador → servidor (Server Actions)
    supabase-workout-repository.ts      Servidor → Postgres (Supabase)
    local-workout-repository.ts         localStorage (modo local)
  controllers/
    workout-controller.tsx  Controller: estado de UI, acciones, avisos; compone modelo + repositorio
  components/             Views: componentes React que leen el modelo
  app/actions/workout.ts  Server Actions: validan los cambios y los escriben en Supabase
  lib/supabase/          Clientes de Supabase con la sesión del usuario (servidor y proxy)
  lib/workout-data.ts     Sesión + carga inicial en el servidor
  proxy.ts                Refresca la sesión y redirige a /login sin ella
  app/                    Rutas: (app)/entrenar, rutina, progreso · login · auth/confirm
supabase/migrations/      Esquema Postgres, RLS y funciones
```

- **S**: cada clase tiene una responsabilidad (modelo, estadísticas, copias, persistencia).
- **O / L**: se añaden almacenamientos implementando `WorkoutRepository` sin tocar el modelo; las implementaciones son intercambiables.
- **I**: el contrato del repositorio solo tiene `load`, `apply` y `flush`.
- **D**: el modelo depende de la interfaz; la implementación concreta se elige en el controlador (raíz de composición).

### Base de datos

| Tabla | Contenido |
|---|---|
| `programs` | Uno por usuario (`user_id`): semanas, calendario semanal y fecha de inicio |
| `exercises` | Ejercicios del plan por día (`local_id` = id que usa la app) |
| `set_logs` | Carga, repeticiones, nota y fecha real por semana/día/ejercicio/serie (la serie 0 es el tick manual del ejercicio) |
| `completed_days` | Días marcados como completados |

Todas las tablas tienen RLS: cada usuario solo accede a su propio programa. `replace_program` (alta y restauración) y `remove_week` (borrar y renumerar) son transaccionales y se ejecutan con los permisos del usuario.

## Seguridad
- `.env*` está en `.gitignore`; solo se sube `.env.example`.
- El servidor accede a Supabase con la sesión de cada usuario y la clave pública; las políticas RLS impiden leer o escribir datos de otra cuenta aunque se manipulen las peticiones.
- No se usa la clave secreta (`sb_secret_…` / `service_role`): no la pongas en las variables de entorno.
- Al cerrar sesión se borra la caché offline del dispositivo, para que la siguiente persona no vea páginas de la cuenta anterior.
