# Admin Order Total Amount Display — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/admin-order-total-amount-display.md](briefs/admin-order-total-amount-display.md)

---

## What Was Delivered

- **Total amount in `/admin` order details:** Employees now see `Total do pedido` in the order details UI (desktop details panel and mobile accordion details via shared content).
- **pt-BR currency formatting:** Totals are displayed in Brazilian currency format (`BRL`) when pricing snapshots are available.
- **Backward-compatible legacy fallback:** Orders without sufficient pricing snapshots show `Total do pedido: Indisponível` and continue rendering normally.
- **Pricing snapshot persistence for new orders:** Customer submissions now persist pricing snapshots inside `public.orders.items` (backward-compatible JSON extension):
  - item `unitPriceCents`
  - item `lineTotalCents`
  - selected extras snapshots include `priceCents`
- **Server pricing authority preserved:** Pricing snapshots are derived server-side from `data/menu.json` in the existing customer submission path (`/api/orders` / shared submit logic), not trusted from client payloads.
- **Fail-closed pricing setup behavior:** If a selected base item or selected extra is missing valid `priceCents` in `data/menu.json`, customer submission is rejected with a pt-BR validation/setup error and no order is created.
- **Stage 4 parser hardening:** `/admin` total parsing now rejects malformed pricing snapshots (negative or implausibly large cents values) and falls back safely to `Indisponível`.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer order submission pricing snapshots (server) | `app/actions.ts` |
| Customer submit API route (uses shared submit logic) | `app/api/orders/route.ts` |
| Admin order parsing + total calculation + fallback | `lib/orders.ts` |
| Admin order details UI (`Total do pedido`) | `components/admin-orders-dashboard.tsx` |
| Submit-path tests (pricing snapshots + fail-closed) | `app/actions.test.ts` |
| Admin parser tests (totals/fallback/hardening) | `lib/orders.test.ts` |
| Admin dashboard UI tests (total display/fallback) | `components/admin-orders-dashboard.test.tsx` |
| Stage 1 implementation notes | `docs/implementation-notes.md` |
| Stage 4 hardening notes | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **Display scope:** Total amount is shown in `/admin` order details only (desktop panel + mobile accordion), not in list rows or summary cards.
- **Pricing source for admin totals:** `/admin` totals are computed from persisted pricing snapshots in `orders.items`, not from current `data/menu.json`.
- **Storage model:** Keep using `public.orders.items` JSON with a backward-compatible shape extension (no required DB migration by default).
- **Legacy/partial pricing fallback:** If total cannot be computed reliably, `/admin` shows `Total do pedido: Indisponível`.
- **Mixed priced/unpriced items:** If any item lacks sufficient pricing snapshot data, the entire order total is treated as unavailable (`Indisponível`) to avoid misleading partial totals.
- **Extras pricing:** Extras are included in totals only when their snapshot has valid `priceCents`; missing extra price snapshot makes total unavailable.
- **Customer submit fail-closed rule:** New customer submissions are rejected when selected items/extras do not have valid `priceCents` in `data/menu.json`.
- **Zero-price values:** `priceCents = 0` is valid and included as zero (not treated as missing).
- **Language/formatting:** Employee-facing total labels remain pt-BR; currency formatting is `BRL` (`pt-BR` locale).

---

## Persisted `orders.items` Shape Extension (Backward-Compatible)

Legacy rows may still contain only:
- `{ name, quantity }`

Newer rows may include pricing snapshots (and extras snapshots) such as:

```json
{
  "menuItemId": "x-burger",
  "name": "X-Burger",
  "quantity": 2,
  "unitPriceCents": 2500,
  "lineTotalCents": 5800,
  "extras": [
    { "id": "bacon-extra", "name": "Bacon extra", "priceCents": 400 }
  ]
}
```

Notes:
- `/admin` parser remains backward-compatible with legacy rows.
- `lineTotalCents` is persisted for convenience, but totals can also be derived from base/extras snapshots when valid.

---

## Admin Total Calculation Behavior

`/admin` computes totals from each parsed item:

- Prefer valid `lineTotalCents` when present
- Otherwise compute from `unitPriceCents + extras[].priceCents` multiplied by `quantity`
- If any required pricing snapshot is missing/invalid for any item, total becomes unavailable (`Indisponível`)

Stage 4 hardening additionally rejects malformed/implausible snapshot values:
- negative cents values
- non-finite values
- values above parser guardrails (unit/extra/line/order caps)

This protects the admin UI from showing absurd totals if historical JSON was edited manually or corrupted.

---

## Known Gaps & Deferred Work

- **No order total column:** Totals are derived from `orders.items` snapshots at read time; there is no dedicated `order_total_cents` DB column.
- **No pricing shown to customers in checkout summary:** This feature is admin-only total visibility; customer-facing pricing UX remains out of scope.
- **No taxes/fees/discounts:** Totals are item/extras snapshots only (no frete, tax, coupon, service fees).
- **No historical backfill:** Legacy orders without pricing snapshots continue showing `Indisponível`.
- **No malformed-pricing telemetry:** Parser fails safe silently without metrics/logging for rejected pricing snapshots.

---

## Operational Notes

- **Menu price configuration is now required for submit path reliability:** If a menu item (or selected extra) used in a customer order lacks valid `priceCents`, submission fails closed with a pt-BR error.
- **Changing menu prices does not alter old order totals:** Previously submitted orders retain historical pricing accuracy because snapshots are persisted in `orders.items`.
- **Admin parser compatibility:** The parser supports mixed historical JSON shapes and degrades to `Indisponível` when pricing data is incomplete or malformed.
- **Regression checks after pricing changes:**
  - new order with priced base item shows `Total do pedido` in `/admin`
  - new order with priced extras includes extras in total
  - legacy order still renders and shows `Indisponível`
  - menu item/extra missing `priceCents` fails customer submission

---

## For the Next Engineer

- **If you add customer-facing pricing UI:** Treat it as a new feature brief and align customer totals with the same snapshot model used by `/admin`.
- **If you add fees/discounts/taxes:** Decide whether to extend `orders.items`, add order-level total columns, or introduce normalized order pricing tables; update parser/tests/docs together.
- **If you add telemetry for malformed snapshots:** Prefer sampled/structured logs or metrics counters to avoid noisy admin-render logs.
- **If you add an order total column later:** Keep `/admin` fallback behavior documented and define migration/backfill strategy for legacy rows explicitly.

---
