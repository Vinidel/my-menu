# Order Payment Method Selection (Customer + Admin) — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/order-payment-method-selection.md](briefs/order-payment-method-selection.md)

---

## What Was Delivered

- **Required payment method selection on customer checkout (`/`):** The `Seu pedido` flow now includes a required radio group (`Modo de pagamento`) with exactly `Dinheiro`, `Pix`, and `Cartão`.
- **Locked payload contract:** Customer submit payload sends `paymentMethod` with canonical values only (`dinheiro`, `pix`, `cartao`) rather than pt-BR labels.
- **Server-side validation authority:** `/api/orders` (via shared submit logic) validates payment method against the locked canonical set and rejects invalid/tampered values.
- **Dedicated persistence on `orders`:** New customer orders persist the selected payment method in `public.orders.payment_method`.
- **DB integrity backstop:** A migration adds `public.orders.payment_method` plus a DB `CHECK` constraint limiting non-null values to `dinheiro`, `pix`, `cartao` (`NULL` allowed for legacy rows).
- **`/admin` payment method display:** Admin order details (desktop and mobile accordion) display `Forma de pagamento` using pt-BR labels.
- **Legacy/unknown fallback rendering:** `/admin` shows `Não informado` for legacy rows (`NULL`) and unexpected stored values.
- **Stage 4 resilience hardening:** Shared payment-method normalization now rejects oversized malformed strings before normalization and safely falls back.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer checkout UI (`/` payment method radio group) | `components/customer-order-page.tsx` |
| Public route page | `app/page.tsx` |
| Shared customer submit logic + server validation | `app/actions.ts` |
| Public order submit API route (uses shared submit logic) | `app/api/orders/route.ts` |
| Shared payment method canonical values/labels/helpers | `lib/payment-methods.ts` |
| Admin order parser + payment method label/fallback mapping | `lib/orders.ts` |
| Admin dashboard details UI (`Forma de pagamento`) | `components/admin-orders-dashboard.tsx` |
| Admin page server load (selects `payment_method`) | `app/admin/page.tsx` |
| Admin polling route (selects `payment_method`) | `app/api/admin/orders/route.ts` |
| Supabase migration (`orders.payment_method` + `CHECK`) | `supabase/migrations/20260224130000_add_orders_payment_method.sql` |
| DB types (`orders.payment_method`) | `lib/supabase/database.types.ts` |
| Tests (submit logic) | `app/actions.test.ts` |
| Tests (customer UI) | `components/customer-order-page.test.tsx` |
| Tests (admin details UI) | `components/admin-orders-dashboard.test.tsx` |
| Tests (shared payment method hardening) | `lib/payment-methods.test.ts` |

---

## Decisions (Locked)

- **Customer UI control type:** Required radio buttons (single selection) on checkout.
- **Allowed options (pt-BR):** `Dinheiro`, `Pix`, `Cartão`.
- **Canonical persisted values:** `dinheiro`, `pix`, `cartao`.
- **Client submit payload contract (locked):**
  - field name: `paymentMethod`
  - value must be canonical (`dinheiro | pix | cartao`), not display label
- **Persistence target:** `public.orders.payment_method` (dedicated column; not embedded in `notes`/`items`).
- **DB constraint policy:** DB-level `CHECK` constraint for canonical non-null values; `NULL` allowed for legacy rows.
- **Server validation authority:** `/api/orders` rejects invalid/tampered payment methods even if client UI is constrained.
- **Admin display scope:** Payment method shown in `/admin` order details only (desktop + mobile accordion details).
- **Admin fallback for missing/unknown values:** `Forma de pagamento: Não informado`.
- **Language:** pt-BR labels/messages for customer and employee UI.

---

## Data Model / Persistence Notes

- **Column added:** `public.orders.payment_method text null`
- **Constraint:** `CHECK (payment_method IS NULL OR payment_method IN ('dinheiro', 'pix', 'cartao'))`
- **Legacy compatibility:** Existing orders may keep `NULL` and must continue rendering in `/admin`.

Notes:
- This feature captures the **intended payment method only**.
- It does **not** process payments or confirm whether payment was completed.

---

## Known Gaps & Deferred Work

- **No payment processing:** This feature does not charge customers or integrate with payment providers.
- **No payment-status tracking:** The app does not track whether a Pix/card/cash payment was completed, received, or failed.
- **No change/troco flow for cash:** No `troco para quanto` field in this feature.
- **No split payments:** Only one payment method per order.
- **No payment analytics:** No telemetry/reporting on payment method distribution yet.

---

## Operational Notes

- **Migration required:** Apply `supabase/migrations/20260224130000_add_orders_payment_method.sql` before testing end-to-end.
- **Admin compatibility:** `/admin` safely renders legacy orders and unknown/manual DB values as `Não informado`.
- **Polling compatibility:** `payment_method` is selected in both `app/admin/page.tsx` and `app/api/admin/orders/route.ts`, so TanStack Query polling preserves payment method display.
- **Regression checks after changes:**
  - submit one order for each option (`Dinheiro`, `Pix`, `Cartão`)
  - confirm canonical values persist in DB
  - confirm `/admin` details show pt-BR labels on desktop and mobile accordion
  - confirm legacy `NULL` row still shows `Não informado`

---

## For the Next Engineer

- **If you add cash change (`troco`) support:** Treat it as a new feature brief; it introduces conditional form fields and new order data.
- **If you add payment status tracking:** Use a separate field (or fields) from `payment_method`; don’t overload this column.
- **If you add in-app payments later:** Keep `payment_method` as the customer-facing selection/snapshot and model provider transaction state separately.
- **If you expand methods (e.g., voucher):** Update `lib/payment-methods.ts`, DB `CHECK` constraint, customer UI, admin label mapping, tests, and docs together.
