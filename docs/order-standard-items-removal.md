# Order Standard Ingredients Removal (`Sem`) — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/order-standard-items-removal.md](briefs/order-standard-items-removal.md)

---

## What Was Delivered

- **Menu schema extension:** `data/menu.json` items can now declare `removableIngredients` (`[{ id, name }]`) in addition to existing `extras`.
- **Customer customization flow (`/`):**
  - Customers can mark removable ingredients in personalization UI (`Sem ...` checkboxes).
  - Main card `Adicionar` now captures current customization draft (extras/removals) when personalization is open.
  - Removed the old `Adicionar com extras` confirm label path to reduce submit ambiguity.
- **Cart line behavior (locked):**
  - Merge/equality now depends on base item + normalized extras + normalized removed ingredients.
  - Different removal sets stay in separate cart lines.
- **Edit flow in cart:**
  - Existing line customization editor supports both extras and removals.
  - Action labels simplified to `Editar` and `Salvar`.
- **Submit payload extension (`/api/orders`):**
  - Per line item supports `removedIngredientIds?: string[]` (alongside `extraIds?: string[]`).
- **Server-side validation/persistence:**
  - `removedIngredientIds` are validated against `menuItem.removableIngredients`.
  - Persisted in `orders.items` snapshot as `removedIngredients: [{ id, name }]`.
- **Admin details rendering (`/admin`):**
  - Item details now display removals as `Sem: ...` when present.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Menu schema/types parsing (`removableIngredients`) | `lib/menu.ts` |
| Menu data examples | `data/menu.json` |
| Customer order UI customization + merge/edit behavior | `components/customer-order-page.tsx` |
| Server normalization/validation/persistence (`removedIngredientIds` -> `removedIngredients`) | `app/actions.ts` |
| Admin order parsing (`removedIngredients`) | `lib/orders.ts` |
| Admin details rendering (`Sem: ...`) | `components/admin-orders-dashboard.tsx` |
| Server submit tests | `app/actions.test.ts` |
| Customer UI tests | `components/customer-order-page.test.tsx` |
| Admin UI tests | `components/admin-orders-dashboard.test.tsx` |
| Hardening notes | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **Naming:**
  - Internal menu schema: `removableIngredients`
  - Client submit payload: `removedIngredientIds`
  - Persisted item snapshot: `removedIngredients`
  - User-facing display prefix: `Sem:`
- **No pricing discount for removals:** Removing ingredients does not alter base price.
- **Server authority:** Allowed removals are validated server-side from current menu config.
- **Merge/equality rule:** line merge requires equality of normalized `extraIds` and normalized `removedIngredientIds`.
- **Backward compatibility:** Legacy `orders.items` without removals continue to parse/render.

---

## Hardening Applied (Stage 4)

- **Customization ID length bounds:** IDs above `80` chars are rejected during server normalization.
- **Structured merge keys:** Aggregation/merge keys now use structured serialization to avoid delimiter-collision edge cases.
- **No new dependencies introduced.**

---

## Known Gaps & Deferred Work

- **No auto-derivation from item description:** Removable ingredients are manually configured in `data/menu.json`.
- **No complex modifier rules:** No conditional combinations, max/min logic, or quantity-per-removal.
- **No dedicated observability counters:** Rejection metrics for customization-bound violations are not emitted separately.

---

## Operational Notes

- **Data setup:** Ensure burger items in `data/menu.json` include `removableIngredients` to expose `Sem ...` checkboxes in customer UI.
- **Regression checks after menu/schema changes:**
  - Add item with removals only.
  - Add item with extras + removals.
  - Edit existing cart line removals.
  - Confirm `/admin` details show `Sem: ...`.
  - Confirm invalid/tampered removal IDs are rejected.
- **No DB migration required:** removals are stored in existing `orders.items` JSON snapshots.

---

## For the Next Engineer

- If you add advanced modifier logic later, split it into a new brief; this feature intentionally stays binary selection per removal.
- If you add analytics/abuse instrumentation, include counters for validation failures caused by invalid/oversized customization IDs.
- If you evolve snapshot shape, update both parser compatibility (`lib/orders.ts`) and customer/admin tests together.
