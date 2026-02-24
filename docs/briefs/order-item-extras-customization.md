# Feature Brief — Order Item Extras / Customization

Status: Stage 0 — Framing
Date: 2026-02-24
Author: Orchestrator Agent

---

## Alternative Name

Extras por item no pedido / Customização de adicionais no cardápio / Adicionais do pedido

---

## Problem

Customers can currently add menu items and quantities, but they cannot customize items with extras (for example: queijo extra, bacon extra). This limits real-world ordering accuracy and forces customers/employees to rely on generic order notes, which are less structured and harder to read in the `/admin` dashboard.

Without item-level extras/customization, the order flow is too rigid for a burger menu where add-ons/removals are common.

---

## Goal

Allow customers to add/remove extras for each selected menu item and persist those choices in a structured, `/admin`-readable format.

Success = a customer can customize a menu item with extras in `/`, submit the order, and employees can clearly see the selected extras for each item in `/admin`.

---

## Who

- **Customers (public users):** Need item-level customization during ordering.
- **Employees (burger owner / staff):** Need to view extras clearly in `/admin` when preparing orders.
- **Developers/operators:** Maintain menu JSON schema and ensure backward compatibility with existing orders/items payloads.

---

## What We Capture / Change

- **Menu JSON schema extension (required):**
  - Add optional extras/customization definitions per menu item in `data/menu.json`
  - Extras must be structured enough for UI rendering and validation (exact schema locked below)
- **Customer ordering UI (`/`):**
  - Customer can open a menu item customization UI and choose extras before adding (or while editing) the item in the order
  - Customer can remove previously selected extras for a specific order item
  - Multiple quantities of the same base item with different extras must be handled deterministically (locked behavior below)
- **Order payload persistence (`public.orders.items` JSON):**
  - Extend item entries to include extras/customization details in a backward-compatible way
  - Existing `{ name, quantity }` compatibility for legacy orders must be preserved
- **Customer submit payload (`POST /api/orders`, locked for this feature):**
  - Customized item instances are submitted as line items with:
    - `menuItemId` (string)
    - `quantity` (positive integer)
    - `extraIds` (string array, optional)
  - `extraIds` is client-submitted UI state only; server validates against current menu JSON and writes normalized snapshots to `orders.items`
- **Employee dashboard display (`/admin`):**
  - Order details must render item extras clearly when present
  - Legacy orders and non-customized items must still render without errors
- **No new table required by default**
  - Extras are stored inside existing `orders.items` JSON in this feature unless implementation reveals a blocker

---

## Success Criteria

- [ ] Menu items can define optional extras/customization options in `data/menu.json` using the locked schema.
- [ ] Customer can select extras for an item before adding it to the order.
- [ ] Customer can edit/remove extras for an already selected item in the order.
- [ ] Customer can submit orders containing a mix of customized and non-customized items.
- [ ] Submitted `orders.items` JSON preserves item extras in a structured format while remaining backward-compatible with existing item parsing.
- [ ] `/admin` order details display selected extras per item in Portuguese (when present) without breaking legacy orders/items.
- [ ] Existing order submission validation and status flow continue to work (no regression in `/api/orders` success/error behavior).
- [ ] Existing summary counts/status progression on `/admin` remain unaffected.
- [ ] All new customer-facing and employee-facing labels/messages for extras/customization are in Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Dynamic pricing/totals calculations for extras (unless already displayed in UI as optional info; no billing logic required in this feature).
- Inventory/availability management for extras.
- Complex modifier rules (e.g., max 2 free toppings, conditional incompatibilities, nested modifier groups) unless explicitly locked in this brief.
- Customer order editing after submission.
- Database normalization into `order_items` / `order_item_extras` relational tables.
- Kitchen printing or separate production tickets.

---

## Acceptance Scenarios

### Happy Paths

1. **Customer adds item with extras.** Customer opens a menu item with available extras, selects one or more extras, adds the item to the order, and sees the selected extras in `Seu pedido`.
2. **Customer edits extras in order summary.** Customer changes extras for a selected item in `Seu pedido` (add/remove extras) and the summary updates correctly.
3. **Customer submits mixed order.** Customer submits an order with one item without extras and another item with extras. Submission succeeds and `/admin` shows both items correctly, including extras on the customized item.
4. **Employee sees extras in order details.** In `/admin`, employee opens the order and clearly sees each item and its selected extras/customizations.

### Unhappy Paths

1. **Invalid extra in payload (tampered request).** `/api/orders` receives an extra id not defined for the selected menu item. Submission is rejected with a Portuguese validation error.
2. **Missing extras schema for item.** A menu item without extras configuration remains orderable and renders normally.
3. **Legacy order item format.** `/admin` opens an older order where `orders.items` entries only contain `{ name, quantity }`; dashboard still renders without errors.
4. **Menu changed after cart selection.** If a selected extra no longer exists in the current menu at submit time, submission is rejected safely with a Portuguese validation error (or equivalent locked validation path).

---

## Edge Cases

- **Same base item with different extras:** Two `X-Burger` entries with different extras should remain distinguishable in the order summary and persisted payload (locked behavior below).
- **No extras selected:** Customized-item UI should allow zero extras if all extras are optional.
- **Duplicate extra selection attempts:** UI should prevent duplicated extras for the same item instance (or normalize duplicates before submit).
- **Unknown extras in historical orders:** `/admin` should render persisted extras data defensively even if labels differ from current menu schema.
- **Optional notes + extras together:** Global order notes (`Observações`) remain separate from item-level extras and both can coexist.

---

## Approach (High-Level Rationale)

1. **Extend menu JSON, not DB schema.** Keep extras definitions in `data/menu.json` alongside menu items to stay aligned with the current menu-source model.
2. **Persist extras inside `orders.items` JSON.** Extend item entries with a backward-compatible `extras` field so existing orders remain readable and no migration is required.
3. **Validate on the server using current menu JSON.** `/api/orders` / shared submit logic must validate that selected extras belong to the selected menu item to prevent tampered payloads.
4. **UI supports per-item customization instances.** Treat each customized selection as an item instance in the customer order summary so different extra combinations don’t collapse incorrectly.
5. **Admin rendering remains defensive.** `/admin` should display extras when present and continue handling legacy item entries gracefully.

---

## Decisions (Locked)

- **Menu source remains `data/menu.json`.**
- **No new DB tables/migrations by default:** Extras/customizations are stored within `public.orders.items` JSON.
- **Persisted order item shape (minimum, backward-compatible extension):**
  - Existing fields remain supported: `{ name, quantity }`
  - New customized entries may include:
    - `menuItemId` (string) for server validation/debugging
    - `extras` (array)
  - `extras` entries store at minimum:
    - `id` (string)
    - `name` (string snapshot)
- **Customer-order item grouping behavior (locked):**
  - Items with the same base menu item **and the same selected extras set** may be merged into one line with increased quantity
  - Items with different extras sets must remain separate lines
- **Extras-set equality / merge normalization (locked):**
  - Equality is based on normalized `extraIds` set per item line
  - Selection order is ignored
  - Duplicate `extraIds` are removed before comparison and before server validation
  - Canonical comparison form is sorted unique `extraIds` (ascending string sort)
- **Extras selection rule set (initial, locked):**
  - Extras are optional
  - Multi-select allowed
  - No quantity-per-extra in this feature (extra is selected or not selected)
- **Customization scope (locked):** This feature supports **additive extras only** (e.g. queijo extra, bacon extra). Removals/substitutions like `sem cebola` are out of scope for this brief.
- **Validation authority:** Server-side validation (current `/api/orders` path) is the source of truth for allowed extras; client-side validation is UX only.
- **Snapshot source (locked):** Server derives and persists extra `name` snapshots from current menu JSON based on validated `extraIds` (do not trust client-provided extra names).
- **Admin display scope:** Extras are shown in order details only (not required in the summary list row).
- **Admin extras display format (minimum, locked):** For each item with extras in `/admin` details, render an `Extras:` line/list directly under that item, showing each selected extra name in pt-BR.
- **Language:** pt-BR for all user-facing labels/messages (customer and employee).

---

## Proposed Menu JSON Schema Extension (Locked for This Feature)

Per menu item, add optional:

- `extras`: array of extra options

Each extra option:
- `id`: string (stable identifier)
- `name`: string (pt-BR label)
- `priceCents?`: number (optional informational field; no billing logic required in this feature)

Scope note: this schema models additive extras only in this feature. Negative/removal modifiers (e.g. `sem cebola`) are out of scope.

Example shape (illustrative):

```json
{
  "id": "x-burger",
  "name": "X-Burger",
  "extras": [
    { "id": "queijo-extra", "name": "Queijo extra", "priceCents": 300 },
    { "id": "bacon-extra", "name": "Bacon extra", "priceCents": 500 }
  ]
}
```

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
