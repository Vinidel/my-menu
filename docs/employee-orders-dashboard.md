# Employee Orders Dashboard — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/employee-orders-dashboard.md](briefs/employee-orders-dashboard.md)

---

## What Was Delivered

- **Dashboard route:** `/admin` now renders the employee orders dashboard (protected by existing auth middleware).
- **Orders list:** Orders are loaded from Supabase and displayed **do mais antigo para o mais recente** (`created_at` ascending).
- **Summary counts:** Top summary cards show totals for the locked statuses:
  - `Esperando confirmação`
  - `Em preparo`
  - `Entregue`
- **Order details:** Clicking an order shows a details panel with customer data, items, current status, and optional notes.
- **Status progression:** Employees can only progress status forward:
  - `aguardando_confirmacao` -> `em_preparo`
  - `em_preparo` -> `entregue`
  - `entregue` -> no next step
- **Error/empty states:** Portuguese empty state and error messages for order load/update failures.
- **Schema + seed:** Supabase migrations for `public.orders` and a demo seed file were added.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Admin dashboard page | `app/admin/page.tsx` |
| Dashboard UI (list/details/summary/actions) | `components/admin-orders-dashboard.tsx` |
| Status progression server action | `app/admin/actions.ts` |
| Order parsing + status helpers | `lib/orders.ts` |
| Supabase DB types | `lib/supabase/database.types.ts` |
| Orders table migration | `supabase/migrations/20260223_000001_create_orders_table.sql` |
| Status transition hardening migration | `supabase/migrations/20260223_000002_enforce_order_status_transitions.sql` *(or renamed equivalent timestamp if you changed the prefix before applying)* |
| Demo seed data | `supabase/seed.sql` |
| Tests (dashboard UI) | `components/admin-orders-dashboard.test.tsx` |
| Tests (server page query/load errors) | `app/admin/page.test.tsx` |

---

## Decisions (Locked)

- **Dashboard route:** Employee orders dashboard lives on the existing protected `/admin` page.
- **Ordering:** Orders are shown **oldest -> newest** by `created_at`.
- **Canonical persisted statuses:** `aguardando_confirmacao`, `em_preparo`, `entregue`.
- **UI labels (pt-BR):** `Esperando confirmação`, `Em preparo`, `Entregue`.
- **Progression rule:** Forward-only progression; no reverse or jump transitions.
- **Concurrency behavior:** Stale updates are rejected (conditional update on `id` + current `status`) and the UI refreshes the displayed status.
- **Language:** All employee-facing UI/messages are Portuguese (pt-BR).

---

## Known Gaps & Deferred Work

- **Supabase typing workaround:** `app/admin/actions.ts` uses narrow cast helpers around Supabase query chains because `@supabase/ssr` generic inference returned `never` for `.update()` in this setup. Runtime behavior is fine, but compile-time safety is weaker than desired. Follow-up: revisit library versions or wrap queries in typed helpers.
- **No pagination/search/filtering:** Dashboard intentionally loads and renders a single ordered list only (brief non-goal). Add a new brief if order volume grows.
- **No realtime updates:** Status/list updates are local UI refreshes after actions; no Supabase Realtime or polling.
- **No structured metrics/tracing:** Server-side logs exist for failures, but there is no metrics/tracing for order operations yet.
- **Dependency backlog:** Existing `npm audit` vulnerabilities remain deferred (see `docs/implementation-notes.md` / `docs/hardening-notes.md`).

---

## Operational Notes

- **Required DB objects:** Apply the orders table migration and the status-transition hardening migration before using the dashboard in production.
- **Migration filename/version:** If Supabase CLI treats only the leading numeric prefix as the migration version, use unique full numeric timestamps for every migration file (e.g. `YYYYMMDDHHMMSS_*`) to avoid `schema_migrations_pkey` conflicts.
- **Seed data:** `supabase/seed.sql` provides demo orders across all three statuses and is safe to re-run (`ON CONFLICT (reference)`).
- **RLS expectations:** Authenticated users can `SELECT` orders and `UPDATE status` only. Status transitions are additionally enforced by DB trigger.
- **Rollback (feature code):** Revert app code changes and (optionally) remove the dashboard UI. For DB rollback, create a dedicated rollback migration (do not manually edit applied migration files).

---

## For the Next Engineer

- **Add parser tests:** `lib/orders.ts` currently has behavior covered indirectly by UI tests; dedicated unit tests for parsing/normalization would reduce regression debugging time.
- **If you change statuses:** Update all of these together:
  - `lib/orders.ts`
  - `supabase` migrations / DB constraints / trigger
  - `components/admin-orders-dashboard.tsx`
  - tests in `components/admin-orders-dashboard.test.tsx`
  - brief + docs
- **If you add admin routes:** Middleware already protects `/admin/*` (except `/admin/login`) from the auth feature; reuse the same admin layout unless you intentionally split layouts.
