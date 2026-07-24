# FinanSaaS

Control de caja bimonetario (ARS/USD) para pymes y profesionales independientes: cuentas, movimientos, categorías y balances en dos monedas desde un mismo dashboard.

**Demo en vivo:** [finanzas-simple.vercel.app](https://finanzas-simple.vercel.app)
**Usuario demo:** `demo@finansaas.app` / `demo1234`

> Los datos de la demo son ficticios. La app corre sobre un proyecto Supabase separado del de producción real; no hay información financiera de terceros expuesta.

---

## Sobre el proyecto

Pensado para el día a día de una pyme o un profesional independiente que necesita ver de un vistazo cuánto tiene, en qué moneda, y de dónde vino cada movimiento. Esta versión está preparada como pieza de portfolio: modelo multi-usuario, con aislamiento de datos por cuenta (Row Level Security en Supabase) y un usuario demo público para que cualquiera pueda probarla sin comprometer datos reales.

## Stack

- **Next.js** + **TypeScript**
- **Supabase** (Postgres + Row Level Security) como backend
- **Zustand** para estado global
- **Sentry** para monitoreo de errores en producción
- **Vercel** para deploy

## Arquitectura

El código sigue un esquema de **Clean Architecture** con repositorios: la lógica de dominio no depende directamente del cliente de Supabase, sino de interfaces de repositorio que se implementan por separado. Esto separa las reglas de negocio (cómo se calcula un balance, cómo se valida una transferencia) de los detalles de infraestructura (qué motor de base de datos hay detrás), y facilita testear y migrar cualquiera de las dos capas sin tocar la otra.

## Seguridad

- Row Level Security activo en todas las tablas; cada política verificada explícitamente contra `pg_policies`, no asumida.
- Aislamiento de datos por usuario (`user_id` + `auth.uid()`) en cuentas y transacciones.
- Sin `service_role key` ni credenciales expuestas en el cliente.
- Monitoreo de errores con Sentry, con masking activo sobre datos sensibles en session replay.

---

*Este repo es la versión portfolio, con datos ficticios y un usuario demo público. La versión de producción original (con datos reales de uso) permanece congelada y privada.*