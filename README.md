# RUTINA · Seguimiento

App web progresiva, adaptada a móvil, creada a partir de las pestañas Resumen, Rutina y Registro del Excel. Empieza con las ocho semanas de la hoja y permite añadir o quitar semanas desde el selector.

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth) · `@supabase/ssr`.

## Incluye
- Plan con cinco días y las indicaciones de cada ejercicio; el número de semanas es ajustable.
- Añadir ejercicios por día con series, objetivo de repeticiones y detalle técnico; eliminar ejercicios cuando ya no se necesiten.
- Registro por serie de carga, repeticiones y nota; conserva las series opcionales.
- Cuentas con correo y contraseña; los datos se sincronizan entre dispositivos.
- Resumen por semana y día, historial de cargas y exportación a CSV.
- Copia y restauración de datos en JSON.
- Instalación en pantalla de inicio (PWA).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # rellena la URL y la clave publishable de Supabase
npm run dev                  # http://localhost:3000
```

Sin `.env.local` la app arranca en **modo local**: sin cuentas, con los datos en el navegador (compatible con los datos de la versión anterior).

### Base de datos
La migración está en `supabase/migrations/`. Aplícala desde el SQL Editor del panel de Supabase o con la CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

En Supabase → Authentication → URL Configuration, añade `https://tu-dominio/auth/confirm` (y `http://localhost:3000/auth/confirm`) a las Redirect URLs.

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
    workout-repository.ts Contrato que usa el modelo
    supabase-workout-repository.ts  Postgres vía Supabase (servidor y navegador)
    local-workout-repository.ts     localStorage (modo local y migración)
  controllers/
    workout-controller.tsx  Controller: estado de UI, acciones, avisos; compone modelo + repositorio
  components/             Views: componentes React que leen el modelo
  lib/supabase/           Clientes de Supabase (navegador, servidor, proxy) y variables públicas
  lib/workout-data.ts     Capa de acceso a datos del servidor (sesión + carga inicial)
  app/                    Rutas: (app)/entrenar, rutina, progreso · login · auth/confirm
  proxy.ts                Refresca la sesión y protege las rutas
supabase/migrations/      Esquema Postgres, RLS y funciones
```

- **S**: cada clase tiene una responsabilidad (modelo, estadísticas, copias, persistencia, autenticación).
- **O / L**: se pueden añadir almacenamientos nuevos implementando `WorkoutRepository` sin tocar el modelo; las dos implementaciones son intercambiables.
- **I**: el contrato del repositorio solo tiene `load`, `apply` y `flush`.
- **D**: el modelo depende de la interfaz; la implementación concreta se elige en el controlador (raíz de composición).

### Base de datos

| Tabla | Contenido |
|---|---|
| `programs` | Uno por usuario: número de semanas |
| `exercises` | Ejercicios del plan por día (`local_id` = id que usa la app) |
| `set_logs` | Carga, repeticiones y nota por semana/día/ejercicio/serie |
| `completed_days` | Días marcados como completados |

Todas las tablas tienen RLS: cada usuario solo accede a su propio programa. `replace_program` (alta y restauración) y `remove_week` (borrar y renumerar) son transaccionales y se ejecutan con los permisos del usuario.

## Variables de entorno y seguridad
- `.env*` está en `.gitignore`; solo se sube `.env.example`.
- Las variables `NEXT_PUBLIC_*` llegan al navegador: usa únicamente la clave **publishable/anon**. La protección real de los datos son las políticas RLS.
- Nunca uses la `service_role` (o `sb_secret_*`) en este proyecto.

## Datos de la versión anterior
Al crear la cuenta, si el navegador tiene datos de la versión anterior (mismo dominio), se suben automáticamente como punto de partida. También puedes descargar una copia JSON en la versión antigua y restaurarla en Progreso.
