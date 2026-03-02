# Feature Brief — Order Standard Ingredients Removal (Sem Ingredientes)

Status: Stage 5 — Documentation Complete (pending Critic)
Date: 2026-03-02
Author: Orchestrator Agent

---

## Alternative Name

Remoção de ingredientes padrão / "Sem cebola" por item / Customização de retirada por item

---

## Problem

The current customer flow supports additive extras only. Customers cannot remove default ingredients from a menu item in a structured way (for example: `sem cebola`, `sem tomate`).

This forces removals into free-text `Observações`, which is less reliable for kitchen execution and harder to parse in `/admin` order details.

---

## Goal

Allow customers to remove predefined standard ingredients per menu item during order customization, persist those removals in structured order data, and show them clearly in `/admin`.

Success = customer can submit item-level removals without using free-text notes, and employees can see those removals per item in admin details.

---

## Who

- **Customers (public users):** Need to remove default ingredients per item when ordering.
- **Employees (burger owner / staff):** Need clear, structured item-level removal instructions in `/admin`.
- **Developers/operators:** Need backward-compatible order item parsing and a menu schema that supports both extras and removable ingredients.

---

## What We Capture / Change

- **Menu JSON schema extension (`data/menu.json`):**
  - Add optional per-item list `removableIngredients`.
- **Customer ordering UI (`/`):**
  - In item customization, customer can mark removable ingredients as "retirar".
  - Same base item with different removals/extras sets remains a separate line item.
- **Customer submit payload (`POST /api/orders`):**
  - Extend each line item with optional `removedIngredientIds: string[]`.
  - Keep `extraIds?: string[]` behavior unchanged.
- **Order payload + persistence (`orders.items` JSON):**
  - Persist selected removals as structured snapshots per item line in `removedIngredients`.
  - Keep existing support for legacy rows and non-customized items.
- **Employee dashboard (`/admin`):**
  - Show removed ingredients per item in order details with pt-BR labels.

---

## Success Criteria

- [ ] Menu items can optionally define removable standard ingredients in `data/menu.json`.
- [ ] Customer can select one or more removals per item before adding to the order.
- [ ] Customer can edit/remove selected removals for an item already in the cart.
- [ ] Payload/DB item snapshots persist removals per line item in structured format.
- [ ] `/api/orders` validates removal IDs against current menu config and rejects tampered values.
- [ ] `/admin` details render removed ingredients per item without breaking legacy orders.
- [ ] Existing extras customization behavior remains functional and compatible with removals.
- [ ] All new user-facing labels/messages remain in Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Free-text parsing of `Observações` to infer removals.
- Auto-generating removable ingredients from menu `description` text.
- Quantity-per-removal controls (binary selected/not selected only).
- Complex modifier rules (mutual exclusions, min/max constraints, dependent options).
- Price adjustments for removals (no discount logic).
- New relational tables for modifiers/removals in this feature.

---

## Acceptance Scenarios

### Happy Paths

1. **Customer removes one default ingredient:** In customization, customer selects `Sem cebola`, adds item, and sees removal listed in cart summary.
2. **Customer submits mixed customization:** Order contains one item with extras and another with removals (or both), submission succeeds.
3. **Customer removes ingredient on item without extras:** Item configured only with `removableIngredients` still supports customization and submit.
4. **Employee sees removals in admin details:** `/admin` order details show removed ingredients for each item line clearly.
5. **Customer edits removals:** Customer reopens item customization in cart and updates removal selection.

### Unhappy Paths

1. **Tampered removal ID:** `/api/orders` receives removal ID not defined for the menu item; returns validation error and does not create order.
2. **Removed ingredient config missing for item:** Item without removable-ingredients config remains orderable without errors.
3. **Legacy order compatibility:** Existing `orders.items` without removals still render in `/admin` normally.
4. **Menu changed after cart selection:** Previously selected removal no longer exists at submit time; submission is rejected safely with pt-BR validation feedback.

---

## Edge Cases

- Same menu item with different removal sets must remain separate lines.
- Removal IDs must be normalized as sorted-unique set before comparison/merge behavior.
- Customer can select zero removals (default behavior).
- Items can contain both extras and removals simultaneously.
- Unknown persisted removal IDs/names in historical data must be rendered defensively in `/admin`.

---

## Approach (High-Level Rationale)

1. Extend `data/menu.json` item schema with optional removable ingredients list.
2. Reuse current customization interaction model (already used for extras) to include removals.
3. Extend `/api/orders` server validation to verify removals against menu config, same authority model as extras.
4. Persist removals inside `orders.items` JSON snapshots for compatibility and no new DB migration.
5. Update admin order-item parsing/rendering to display removals defensively.

---

## Decisions (Locked)

- **Naming (locked):**
  - Product/UI term: `ingredientes removíveis` (`Sem ...` in labels)
  - Internal schema term: `removableIngredients`
  - Client payload term: `removedIngredientIds`
  - Persisted snapshot term: `removedIngredients`
- **Data source remains menu JSON:** Removable ingredients are configured in `data/menu.json`.
- **Structured per-item removals:** Removals are item-level data, not order-level notes.
- **No pricing impact:** Removing standard ingredients does not change base price in this feature.
- **Client payload contract (locked):** each submit line in `items[]` may include:
  - `menuItemId: string`
  - `quantity: number`
  - `extraIds?: string[]` (existing)
  - `removedIngredientIds?: string[]` (new)
  - max `20` ids per line item (aligned with extras cap for this phase)
- **Normalization rule (locked):**
  - `extraIds` and `removedIngredientIds` are each normalized to sorted-unique sets
  - selection order is ignored
  - duplicates are removed before comparison and validation
- **Line merge/equality rule (locked):**
  - Lines merge only when `menuItemId` is equal AND normalized `extraIds` set is equal AND normalized `removedIngredientIds` set is equal
  - Any difference in extras or removals keeps separate lines
- **Validation authority:** Server-side validation in `/api/orders` is source of truth; client validation is UX only.
- **Validation constraints (locked):**
  - `removedIngredientIds` values must belong to `menuItem.removableIngredients[].id`
  - tampered/unknown IDs are rejected with pt-BR validation error
- **Persistence location:** Removals are stored in `orders.items` JSON snapshots (no new tables/migrations).
- **Persisted snapshot shape (locked minimum):**
  - Existing extras snapshot remains unchanged
  - Optional `removedIngredients: Array<{ id: string; name: string }>`
  - `name` snapshot is derived server-side from current menu JSON (never trusted from client)
- **Admin display scope:** Show removals in `/admin` order details only.
- **Language:** pt-BR for all new user-facing strings.

---

## Proposed Menu JSON Schema Extension (Locked for This Feature)

Per menu item, add optional:

- `removableIngredients`: array of removable ingredient options

Each removable ingredient option:

- `id`: string (stable identifier)
- `name`: string (pt-BR label, usually rendered as `Sem {name}` in customer UI)

Example shape (illustrative):

```json
{
  "id": "x-burger",
  "name": "X-Burger",
  "extras": [
    { "id": "queijo-extra", "name": "Queijo extra", "priceCents": 300 }
  ],
  "removableIngredients": [
    { "id": "cebola", "name": "Cebola" },
    { "id": "tomate", "name": "Tomate" }
  ]
}
```

---

## API / Persistence Contract Addendum (Locked)

- **`/api/orders` item payload extension:** `removedIngredientIds?: string[]`
- **`orders.items` extension (backward-compatible):**
  - optional `removedIngredients: Array<{ id: string; name: string }>`
- **Legacy compatibility:** existing rows/items without this field continue to render and process.

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
