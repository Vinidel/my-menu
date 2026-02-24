# Feature Brief — Display Total Order Amount in Admin Order Details

Status: Stage 0 — Framing
Date: 2026-02-24
Author: Orchestrator Agent

---

## Alternative Name

Total do pedido no `/admin` / Valor total no detalhe do pedido / Total monetário dos pedidos

---

## Problem

Employees can see order items and extras in `/admin`, but they cannot see the total monetary amount of the order in the order details. This makes manual checking and reconciliation harder (for example, confirming the expected amount before delivery/pickup).

The current system also does **not** persist pricing snapshots in `orders.items`, so even though menu items may have `priceCents` in `data/menu.json`, historical order totals are not reliably available from stored order data.

Without a total in the admin details, the dashboard is operationally incomplete for price confirmation use cases.

---

## Goal

Show the **total order amount** in `/admin` order details in pt-BR currency format, using a reliable pricing source for new orders while preserving backward compatibility with existing orders.

Success = employee opens an order in `/admin` and sees `Total do pedido: R$ ...` when pricing data is available; legacy orders without sufficient pricing data remain readable and are handled deterministically (locked below).

---

## Who

- **Employees (burger owner / staff):** Need order totals visible in `/admin` details for price confirmation and operational checks.
- **Customers:** Indirectly affected only (future orders may persist pricing snapshots for admin use).
- **Developers/operators:** Must preserve backward compatibility with existing `orders.items` JSON and avoid breaking current order flows.

---

## What We Capture / Change

- **Admin dashboard (`/admin`) order details:**
  - Display total order amount in the details panel/expanded mobile accordion when available
  - Keep existing items/extras/status rendering unchanged
- **Order data persistence for new customer orders (required for reliable totals):**
  - Extend `public.orders.items` JSON entries (backward-compatible) to persist pricing snapshots for new orders
  - Include enough data to calculate exact line totals and order total later even if menu prices change
- **Customer order submit path (`/api/orders` / shared submit logic):**
  - Derive pricing snapshots server-side from current `data/menu.json` (do not trust client prices)
  - Persist pricing snapshots for base item and selected extras (if any)
- **Legacy order handling in `/admin`:**
  - Existing orders without sufficient pricing snapshots must not break rendering
  - Total display behavior for legacy/partial data is locked below

---

## Success Criteria

- [ ] `/admin` order details display `Total do pedido` in pt-BR currency format when an order has sufficient pricing snapshot data.
- [ ] Total display appears in both desktop details panel and mobile accordion details (same order details content parity).
- [ ] New customer-submitted orders persist pricing snapshots in `orders.items` (backward-compatible extension).
- [ ] Server derives persisted pricing snapshots from menu JSON (base item + selected extras), not from client-provided values.
- [ ] Order total calculation includes selected extras for customized items (when extras have `priceCents`).
- [ ] New customer submissions are rejected (pt-BR error) when any selected base item or extra is missing valid `priceCents` required for pricing snapshots.
- [ ] Legacy orders without sufficient pricing snapshot data render safely and use the locked fallback display behavior (no crashes).
- [ ] Existing status progression, polling, status-first sorting, and extras rendering on `/admin` remain unaffected.
- [ ] Existing customer submission validation and anti-abuse behavior remain unaffected.
- [ ] All new employee-facing labels/messages remain in Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Payment processing / charging customers.
- Discount/coupon/tax/frete calculation.
- Backfilling historical orders with exact totals.
- Reconciliation reports/exporting totals.
- Repricing existing orders when menu changes.
- Relational normalization into `order_items` / `order_totals` tables (unless implementation reveals a blocker).

---

## Acceptance Scenarios

### Happy Paths

1. **Admin sees total for a new simple order.** Customer submits an order with base items only. Employee opens the order in `/admin` and sees `Total do pedido` formatted in pt-BR currency.
2. **Admin sees total including extras.** Customer submits an order with extras (e.g., bacon/cheese extra). Employee opens the order in `/admin` and the total includes the extras values.
3. **Mobile admin sees total in accordion details.** On mobile viewport, employee expands an order inline and sees the same total information in the details content.
4. **Menu changes later, stored total remains correct for prior order.** After a price change in `data/menu.json`, a previously submitted order still shows the original total based on persisted pricing snapshots.

### Unhappy Paths

1. **Legacy order without pricing snapshots.** `/admin` opens an older order whose `items` only contain `{ name, quantity }`; details render normally and total uses the locked fallback display.
2. **Partial/malformed pricing data in stored item JSON.** `/admin` renders the order safely and uses the locked fallback display instead of crashing or showing misleading totals.
3. **Menu item price missing for new submission.** If a selected item/extra lacks valid `priceCents` needed for snapshotting, submission is rejected with a Portuguese validation/setup error (fail closed) and no order is created.

---

## Edge Cases

- **Mixed legacy + snapshot items in one order:** If an order contains a mix of priced and unpriced item entries (unexpected/manual edits), total behavior must be deterministic (locked below).
- **Extras without `priceCents`:** Extras may exist for display but omit pricing; total calculation behavior must be explicit (locked below).
- **Unknown historical extras shapes:** `/admin` should keep rendering defensively and avoid total miscalculation from malformed extras data.
- **Currency rounding:** Totals should be calculated in integer cents and formatted at render time (avoid floating point drift).
- **Polling updates in `/admin`:** Total display must remain stable during polling refreshes and status progression updates.

---

## Approach (High-Level Rationale)

1. **Persist pricing snapshots in `orders.items` JSON (backward-compatible).** This avoids schema churn and preserves historical accuracy for new orders while staying aligned with the current JSON-based order item storage.
2. **Server-side pricing authority.** Reuse `data/menu.json` on the server submit path to derive and persist base/extras price snapshots; do not trust client prices.
3. **Admin computes total from persisted snapshots.** `/admin` should calculate/display totals from stored pricing snapshots, not current menu prices, so past orders remain accurate after menu changes.
4. **Safe fallback for legacy/malformed data.** Keep existing `/admin` details usable even when totals cannot be computed reliably.
5. **No workflow changes.** Status progression, polling, auth, and anti-abuse remain unchanged.

---

## Decisions (Locked)

- **Feature scope:** Add total amount display to `/admin` order details and the minimal snapshot persistence needed for reliable totals on new orders.
- **Storage model:** Keep using `public.orders.items` JSON (backward-compatible extension); no required DB migration by default.
- **Pricing authority:** Server derives persisted pricing snapshots from current `data/menu.json` during customer order submission.
- **Persisted pricing snapshot fields (minimum, locked):**
  - Per item:
    - `unitPriceCents` (base item unit price snapshot, integer)
    - optional `extras` entries keep existing extras snapshot fields (`id`, `name`) and include `priceCents` snapshot (integer) when priced
  - Optional derived `lineTotalCents` may be persisted if implementation chooses, but is not required if exact calculation from snapshots remains deterministic
- **Admin total calculation source (locked):** Calculate from persisted snapshots in `orders.items`, not from current menu prices.
- **Legacy/partial pricing fallback display (locked):** If the total cannot be computed reliably for an order, `/admin` shows `Total do pedido: Indisponível` (pt-BR) and still renders all other order details.
- **Mixed priced/unpriced item behavior (locked):** If any order item lacks sufficient pricing snapshot data, the entire order total is treated as unavailable (`Indisponível`) to avoid misleading partial totals.
- **Extras pricing behavior (locked):**
  - If an extra has valid `priceCents` snapshot, include it in the total
  - If a selected extra has no valid price snapshot, total becomes unavailable (`Indisponível`) for that order (avoid implicit zero pricing ambiguity)
- **New submission behavior when price snapshot cannot be derived (locked):** Reject the customer submission with a Portuguese validation/setup error (fail closed) if any selected base item or selected extra lacks valid `priceCents` in `data/menu.json`; do not create the order.
- **Zero-price values (locked):** `priceCents = 0` is valid and must be included in total calculations as zero (not treated as missing pricing data).
- **Currency formatting:** pt-BR currency (`BRL`) formatting in `/admin`.
- **Display scope:** Total shown in order details only (desktop panel + mobile accordion), not required in list rows or summary cards.
- **Language:** All new employee-facing labels/messages remain pt-BR.

---

## Stage 0 Exit Gate

- [x] Problem is clearly defined
- [x] Goals are concrete and testable
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] Approach is outlined at a high level (no code)
- [ ] Critic has approved this brief
