# RUTINA · Seguimiento

App web progresiva, adaptada a móvil, creada a partir de las pestañas Resumen, Rutina y Registro del Excel. Empieza con las ocho semanas de la hoja y permite añadir o quitar semanas desde el selector.

App personal, sin login. **Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres).

## Incluye
- Plan con cinco días y las indicaciones de cada ejercicio; el número de semanas es ajustable.
- Añadir ejercicios por día con series, objetivo de repeticiones y detalle técnico; eliminar ejercicios cuando ya no se necesiten.
- Registro por serie de carga, repeticiones y nota; conserva las series opcionales.
- Datos en Supabase: los mismos en cualquier dispositivo.
- Resumen por semana y día, historial de cargas y exportación a CSV.
- Copia y restauración de datos en JSON.
- Instalación en pantalla de inicio (PWA).

## Puesta en marcha

### 1. Base de datos (Supabase)
En el SQL Editor del proyecto, ejecuta en orden los archivos de `supabase/migrations/`:
1. `20261028000000_init_workout_schema.sql`
2. `20261029000000_single_owner_mode.sql`

### 2. Variables de entorno
En Vercel → Settings → Environment Variables (Production y Preview), o en `.env.local` para desarrollo:

| Variable | Dónde está |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) o `service_role` |

Después de añadirlas o cambiarlas en Vercel, vuelve a desplegar.

Sin estas variables la app arranca en **modo local**: datos solo en el navegador, compatible con la versión anterior. La primera vez que se conecta a una base de datos vacía, sube los datos locales de ese navegador como punto de partida.

### 3. Desarrollo
```bash
npm install
npm run dev   # http://localhost:3000
```

## Arquitectura (MVC + SOLID)

```
src/
  domain/                 Model: reglas de negocio puras (sin React ni Supabase)
    types.ts              Tipos del dominio y de los cambios (WorkoutChange)
    snapshot.ts           Formato del estado, claves y validación
    workout-model.ts      Modelo observable: rutina, series, semanas, días completados
    workout-stats.ts      Estadísticas e historial de cargas (solo lectura)
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
  lib/supabase/admin.ts   Cliente de Supabase del servidor (clave secreta)
  lib/workout-data.ts     Carga inicial en el servidor
  app/                    Rutas: (app)/entrenar, rutina, progreso
supabase/migrations/      Esquema Postgres, RLS y funciones
```

- **S**: cada clase tiene una responsabilidad (modelo, estadísticas, copias, persistencia).
- **O / L**: se añaden almacenamientos implementando `WorkoutRepository` sin tocar el modelo; las implementaciones son intercambiables.
- **I**: el contrato del repositorio solo tiene `load`, `apply` y `flush`.
- **D**: el modelo depende de la interfaz; la implementación concreta se elige en el controlador (raíz de composición).

### Base de datos

| Tabla | Contenido |
|---|---|
| `programs` | El programa de la app (uno, sin usuario): número de semanas |
| `exercises` | Ejercicios del plan por día (`local_id` = id que usa la app) |
| `set_logs` | Carga, repeticiones y nota por semana/día/ejercicio/serie |
| `completed_days` | Días marcados como completados |

`replace_program` (alta y restauración) y `remove_week` (borrar y renumerar) son transaccionales.

## Seguridad
- `.env*` está en `.gitignore`; solo se sube `.env.example`.
- La clave secreta solo la usa el servidor (sin `NEXT_PUBLIC_`), nunca llega al navegador. Las tablas tienen RLS: con la clave pública nadie puede leer ni escribir.
- La app no tiene login: **cualquiera que conozca la URL puede usarla**. No compartas la dirección. Si hace falta, se puede añadir un PIN o la protección por contraseña de Vercel.
