# Order Delivery Option (Customer + Admin) — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/order-delivery-option.md](briefs/order-delivery-option.md)

---

## What Was Delivered

- **Required fulfillment selection on customer checkout (`/`):** The `Seu pedido` flow now includes a `Tipo de entrega` radio group with exactly `Retirada` and `Entrega`.
- **Locked default behavior:** `Retirada` stays preselected, so existing pickup ordering behavior still works without extra customer interaction.
- **Locked payload contract:** Customer submit payload sends `fulfillmentType` with canonical values only (`retirada`, `entrega`) rather than pt-BR labels.
- **Server-side pricing authority:** Shared order submission logic validates `fulfillmentType`, rejects invalid/tampered values, and derives the delivery fee server-side.
- **Dedicated persistence on `orders`:** New customer orders persist both `public.orders.fulfillment_type` and `public.orders.delivery_fee_cents`.
- **DB integrity backstops:** The migration limits non-null fulfillment values to `retirada` / `entrega`, blocks negative delivery fees, and enforces valid fulfillment/fee combinations.
- **`/admin` fulfillment display:** Admin order details show `Tipo de entrega` using pt-BR labels.
- **Legacy/unknown fallback rendering:** `/admin` shows `Não informado` for legacy rows (`NULL`) and unexpected stored values.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer checkout UI (`/` fulfillment radio group + total update) | `components/customer-order-page.tsx` |
| Shared fulfillment canonical values/labels/helpers | `lib/fulfillment-types.ts` |
| Shared customer submit logic + server validation | `app/actions.ts` |
| Public order submit API route (uses shared submit logic) | `app/api/orders/route.ts` |
| Admin order parser + fulfillment label/fallback mapping | `lib/orders.ts` |
| Admin dashboard details UI (`Tipo de entrega`) | `components/admin-orders-dashboard.tsx` |
| Admin page server load (selects fulfillment columns) | `app/admin/page.tsx` |
| Admin polling route (selects fulfillment columns) | `app/api/admin/orders/route.ts` |
| Supabase migration (`orders.fulfillment_type` + `delivery_fee_cents` + constraints) | `supabase/migrations/20260309100000_add_orders_fulfillment_type.sql` |
| DB types (`orders.fulfillment_type`, `orders.delivery_fee_cents`) | `lib/supabase/database.types.ts` |
| Tests (submit logic) | `app/actions.test.ts` |
| Tests (customer UI) | `components/customer-order-page.test.tsx` |
| Tests (admin parser) | `lib/orders.test.ts` |
| Tests (admin details UI) | `components/admin-orders-dashboard.test.tsx` |

---

## Decisions (Locked)

- **Customer UI control type:** Required radio buttons on checkout.
- **Allowed options (pt-BR):** `Retirada`, `Entrega`.
- **Canonical persisted values:** `retirada`, `entrega`.
- **Client submit payload contract (locked):**
  - field name: `fulfillmentType`
  - value must be canonical (`retirada | entrega`), not display label
- **Delivery fee (locked):** `R$ 5,00` (`500` cents) added only for `entrega`.
- **Server validation authority:** `/api/orders` rejects invalid/tampered fulfillment values and does not trust client-provided totals.
- **Persistence target:** `public.orders.fulfillment_type` and `public.orders.delivery_fee_cents`.
- **Historical pricing policy:** Delivery surcharge is stored per order so older totals remain accurate if business rules change later.
- **Admin display scope:** Fulfillment type is shown in `/admin` order details only.
- **Admin fallback for missing/unknown values:** `Tipo de entrega: Não informado`.
- **Address capture policy:** No delivery address is collected in this feature.
- **Status flow policy:** Delivery does not change admin status progression in this feature.
- **Language:** pt-BR labels/messages for customer and employee UI.

---

## Data Model / Persistence Notes

- **Columns added:**
  - `public.orders.fulfillment_type text null`
  - `public.orders.delivery_fee_cents integer null`
- **Constraints:**
  - `CHECK (fulfillment_type IS NULL OR fulfillment_type IN ('retirada', 'entrega'))`
  - `CHECK (delivery_fee_cents IS NULL OR delivery_fee_cents >= 0)`
  - consistency check requiring:
    - both values `NULL` for legacy rows
    - `retirada` => `0`
    - `entrega` => `500`
- **Legacy compatibility:** Existing orders may keep both fields `NULL` and must continue rendering in `/admin` as `Não informado`.

Notes:
- This feature captures **fulfillment intent only**.
- It does **not** capture delivery address or delivery progress state.

---

## Known Gaps & Deferred Work

- **No address capture:** Staff still collect address/details later when confirming the order with the customer.
- **No delivery-specific status flow:** `out for delivery` or any delivery lifecycle stage is deferred to a separate feature.
- **Customer estimated total gap remains:** Checkout `Total estimado` still does not fully include extras pricing; this feature only layered the fixed delivery fee on top of the existing behavior.
- **No delivery-specific observability:** Failures are diagnosable through existing logs only; there are no dedicated counters or alerts for fulfillment validation rejects.
- **No variable delivery pricing:** Delivery fee is fixed; there is no distance, neighborhood, or order-value logic.

---

## Operational Notes

- **Migration required before rollout:** Apply `supabase/migrations/20260309100000_add_orders_fulfillment_type.sql` before or alongside the app deploy.
- **Rollout dependency matters:** If app code is deployed before the migration, submit/admin paths can fail because the new columns and constraints do not exist yet.
- **Admin compatibility:** `/admin` safely renders legacy rows and unexpected manual values as `Não informado`.
- **Regression checks after changes:**
  - submit one `Retirada` order and confirm `delivery_fee_cents = 0`
  - submit one `Entrega` order and confirm `delivery_fee_cents = 500`
  - confirm `/admin` details show `Tipo de entrega` correctly
  - confirm a legacy row with `NULL` fulfillment fields still shows `Não informado`

---

## For the Next Engineer

- **If you add address capture:** Treat it as a separate feature brief; it changes checkout UX, validation, and persistence.
- **If you add delivery status stages:** Model them separately from `fulfillment_type`; delivery intent and order lifecycle are different concerns.
- **If you change the delivery fee later:** Update `lib/fulfillment-types.ts`, server validation, the DB consistency constraint, tests, and docs together.
- **If you expose fulfillment in more admin surfaces:** Reuse the canonical helpers in `lib/fulfillment-types.ts` and preserve the `Não informado` fallback for legacy safety.
