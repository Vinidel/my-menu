# Order Item Extras / Customization — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/order-item-extras-customization.md](briefs/order-item-extras-customization.md)

---

## What Was Delivered

- **Additive extras in menu JSON:** Menu items can now define optional `extras` in `data/menu.json` (`id`, `name`, optional `priceCents`).
- **Customer extras customization on `/`:**
  - customers can open `Personalizar` for supported items
  - select multiple extras before adding
  - edit/remove extras for an existing line in `Seu pedido`
- **Deterministic line-item grouping:** Same base item + same normalized extras set merges quantity; different extras sets remain separate lines.
- **Locked client payload contract:** Customer submit payload to `POST /api/orders` now supports line items with `{ menuItemId, quantity, extraIds? }`.
- **Server-side validation authority:** `/api/orders` / shared submit logic validates `extraIds` against the current menu JSON and rejects tampered extras ids.
- **Structured extras snapshots in `orders.items`:** New order items persist extras in a backward-compatible JSON extension (with server-derived `{ id, name }` snapshots).
- **`/admin` extras display:** Admin order details render an `Extras:` line for items that contain extras while preserving legacy order item rendering.
- **Stage 4 parser hardening:** `/admin` extras parsing now bounds extras array size and truncates oversized extras fields from persisted JSON before rendering.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer ordering UI (`/`) | `components/customer-order-page.tsx` |
| Public route page | `app/page.tsx` |
| Order submit API route (uses shared submit logic) | `app/api/orders/route.ts` |
| Shared submit logic + extras validation/persistence | `app/actions.ts` |
| Menu schema/parser (extras support) | `lib/menu.ts` |
| Admin order parser (extras parsing + hardening) | `lib/orders.ts` |
| Admin dashboard UI (extras display in details) | `components/admin-orders-dashboard.tsx` |
| Menu JSON source (sample extras) | `data/menu.json` |
| Tests (customer UI) | `components/customer-order-page.test.tsx` |
| Tests (submit logic) | `app/actions.test.ts` |
| Tests (admin details rendering) | `components/admin-orders-dashboard.test.tsx` |
| Tests (admin parser hardening) | `lib/orders.test.ts` |

---

## Decisions (Locked)

- **Customization scope:** Additive extras only (e.g., `Queijo extra`, `Bacon extra`).
- **No removals/substitutions:** Cases like `sem cebola` are out of scope for this feature.
- **No DB schema changes by default:** Extras are stored inside existing `public.orders.items` JSON (no `order_items` / `order_item_extras` tables).
- **Client submit payload (locked):**
  - `items[]` entries include `menuItemId`, `quantity`, and optional `extraIds[]`
- **Extras-set equality / merge normalization (locked):**
  - selection order ignored
  - duplicates removed
  - compare with sorted unique `extraIds`
- **Server validation authority:** Server validates extras ids against current menu JSON and does not trust client extra names.
- **Snapshot source:** Server writes extras snapshots (`{ id, name }`) into `orders.items`.
- **`/admin` display scope:** Extras shown in order details only (not required in summary rows).
- **Language:** pt-BR labels/messages for customer and employee UI.

---

## Persisted `orders.items` Shape (Extension)

Backward compatibility is preserved.

- **Legacy items (still supported):**
  - `{ name, quantity }`
- **Customized items (new extension):**
  - `{ name, quantity, menuItemId, extras?: [{ id, name }] }`

Notes:
- `menuItemId` is persisted for validation/debugging context.
- `extras` names are snapshots derived server-side from the menu JSON at submit time.
- `/admin` parser remains defensive for historical/custom JSON variants.

---

## Known Gaps & Deferred Work

- **No pricing/billing logic for extras:** `priceCents` on extras is informational only; order totals/billing do not include extras pricing.
- **No advanced modifier rules:** No max-per-group, incompatibilities, nested modifiers, or quantity-per-extra.
- **No substitution/removal modifiers:** Requests like `sem cebola` remain in global `Observações` if needed (out of scope here).
- **No relational normalization:** Extras are not normalized into separate order-item tables yet.
- **No route-level `/api/orders` extras pass-through test:** Stage 2 covers payload contract in UI and validation in shared submit logic, but not an HTTP-layer extras-specific route test.
- **Silent truncation in `/admin` parser hardening:** Oversized persisted extras values are truncated for safe rendering; no telemetry is emitted yet.

---

## Operational Notes

- **Menu maintenance:** Extras are defined in `data/menu.json`; keep `id` values stable if historical order readability matters.
- **Server validation coupling:** Changing extras ids in the menu will affect submit validation for in-progress carts (expected behavior); stale carts are rejected safely.
- **Admin compatibility:** `lib/orders.ts` supports legacy `{ name, quantity }` items and defensive extras parsing from historical JSON variants.
- **Hardening behavior (`/admin` parser):**
  - max parsed extras per item: `20`
  - oversized extras `name`/`id` values are truncated before rendering
- **Regression checks after menu/extras changes:**
  - submit customized order from `/`
  - confirm extras appear in `/admin` details as `Extras: ...`
  - verify legacy seeded orders still render

---

## For the Next Engineer

- **If you add pricing totals for extras:** Extend persisted item snapshots and update customer/admin totals consistently (plus tests and docs).
- **If you add substitutions/removals:** Treat it as a new feature brief (different schema/rules than additive extras).
- **If you normalize order items into tables later:** Preserve backward compatibility in `lib/orders.ts` while migrations/data backfills are in progress.
- **If you tighten parser hardening further:** Add telemetry or import-time validation so data issues are visible instead of only truncated at render time.
