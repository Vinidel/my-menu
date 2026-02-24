# Customer Order Submission — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/customer-order-submission.md](briefs/customer-order-submission.md)

---

## What Was Delivered

- **Public route `/`:** Replaced placeholder with a real customer ordering flow.
- **Menu from JSON:** Menu is loaded from `data/menu.json` (with optional category/description/price fields).
- **Tabbed customer UX:** Top-level tabs for `Cardápio` and `Seu pedido`, plus category tabs inside the menu.
- **Cart / selection:** Customers can add multiple items, adjust quantities, and remove items by reducing quantity to zero.
- **Checkout form:** Required `Nome`, `E-mail`, `Telefone` with inline pt-BR validation; optional `Observações`.
- **Submission API:** `POST /api/orders` handles order submission and returns real HTTP status codes (`201/400/413/415/500/503`).
- **Order persistence:** New orders insert into `public.orders` with:
  - `status = aguardando_confirmacao`
  - `customer_id` link to `public.customers`
  - snapshot fields (`customer_name`, `customer_email`, `customer_phone`)
  - `items` payload compatible with `/admin` (`[{ name, quantity }]`)
  - optional `notes` from `Observações`
- **Customer dedupe:** Reuse existing `public.customers` row by normalized `email + phone` (email lowercased/trimmed, phone digits-only).
- **Service-role write path:** Submission uses server-only `SUPABASE_SERVICE_ROLE_KEY` in `/api/orders`; public direct table writes were locked down in a later migration.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Public page (`/`) | `app/page.tsx` |
| Customer page UI (tabs/menu/cart/form) | `components/customer-order-page.tsx` |
| Order submit API route | `app/api/orders/route.ts` |
| Shared submit logic (validation/dedupe/insert) | `app/actions.ts` |
| Menu parsing helpers | `lib/menu.ts` |
| Service-role Supabase client | `lib/supabase/service-role.ts` |
| Supabase DB types | `lib/supabase/database.types.ts` |
| Menu JSON source | `data/menu.json` |
| Customers table migration | `supabase/migrations/20260223230000_create_customers_table.sql` |
| Orders `customer_id` + public insert policy migration (initial impl) | `supabase/migrations/20260223230001_add_customer_id_to_orders_and_public_insert_policy.sql` |
| Lock-down migration after service-role switch | `supabase/migrations/20260224110000_lock_down_public_order_submission_tables.sql` |
| Tests (customer page UI) | `components/customer-order-page.test.tsx` |
| Tests (`/api/orders`) | `app/api/orders/route.test.ts` |

---

## Decisions (Locked)

- **Route:** Customer order flow lives on `/`.
- **Menu source:** Local JSON at `data/menu.json`.
- **Customer tracking:** `public.customers` added for contact reuse/history.
- **Order/customer link:** `public.orders.customer_id uuid null references public.customers(id)` (legacy rows may remain `NULL`).
- **Customer dedupe normalization:**
  - `email`: trim + lowercase
  - `phone`: trim + digits-only
  - Match on normalized `email + phone`
- **Order snapshots retained:** `public.orders` keeps submitted `customer_name`, `customer_email`, `customer_phone` even with `customer_id`.
- **Initial status:** `aguardando_confirmacao`
- **Items payload shape:** JSON array entries with at least `{ name, quantity }`
- **Language:** All customer-facing UI/messages are Portuguese (pt-BR)
- **Migrations:** Timestamped filenames (`YYYYMMDDHHMMSS_*`)

---

## Known Gaps & Deferred Work

- **No rate limiting / CAPTCHA:** `/api/orders` is public and uses a service-role write path. Abuse/spam protection is deferred (documented in `docs/hardening-notes.md`).
- **No pricing snapshots on orders:** Only `{ name, quantity }` is persisted in `orders.items` for admin compatibility. Historical totals/line prices are not stored yet.
- **No address / delivery flow:** Out of scope for this feature.
- **No realtime customer updates:** Customers only see submission success/failure; no status tracking UI.
- **No category tests yet:** Category tab filtering is implemented but not specifically covered by tests (non-critical for current brief).
- **Supabase typed-chain casts:** `app/actions.ts` still uses local cast helpers for query chains due type inference limitations in this setup.

---

## Operational Notes

- **Required env vars (server + client):**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose as `NEXT_PUBLIC_*`)
- **Required migrations:** Apply all customer-flow migrations, including the lock-down migration:
  - `20260223230000_create_customers_table.sql`
  - `20260223230001_add_customer_id_to_orders_and_public_insert_policy.sql`
  - `20260224110000_lock_down_public_order_submission_tables.sql`
- **Security posture after service-role switch:** Public clients should not read/write `customers` directly or insert into `orders` directly. The hardening migration removes those grants/policies.
- **API behavior (`POST /api/orders`):**
  - `201` success
  - `400` validation / malformed JSON
  - `413` oversized body
  - `415` non-JSON content type
  - `500` internal failure
  - `503` setup/config unavailable
- **Caching:** API responses send `Cache-Control: no-store`.
- **Manual smoke test:** Submit from `/` and confirm new order appears in `/admin` with `Esperando confirmação` and optional `Observações`.

---

## For the Next Engineer

- **If you change menu schema:** Update `data/menu.json`, `lib/menu.ts`, and any UI/tests relying on category/price/description rendering.
- **If you add anti-abuse controls:** Start with `/api/orders` (rate limiting, CAPTCHA, IP throttling, bot heuristics), then document operational tuning in `docs/hardening-notes.md`.
- **If you add price totals/history:** Extend `orders.items` payload (or add explicit columns) and update the admin parser in `lib/orders.ts` plus tests.
- **If you change customer dedupe rules:** Update both the implementation (`app/actions.ts`) and DB uniqueness/index strategy (`public.customers`) together.
