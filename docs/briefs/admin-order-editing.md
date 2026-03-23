# Feature Brief — Admin Order Editing

Status: Stage 0 — Framing
Date: 2026-03-23
Author: Orchestrator Agent
Workflow: Full

---

## Workflow Routing Decision

Change type: feature
Workflow selected: Full
Reason:

- Scope: New admin capability touching multiple layers (API, data access, UI, auth, DB permissions). Admin must edit all customer-editable fields with same validation and snapshot logic.
- Risk: Medium — expands DB grant for authenticated users; must preserve status-transition integrity and avoid regressions in customer submission path.
- Blast radius: Admin dashboard, admin API/actions, Supabase RLS/grants, shared order validation/snapshot logic.
- Urgency: Normal.
- Required stages: Implementer, Tester, Hardener, Documenter
- Skipped stages and why: None.

---

## Alternative Name

Edição de pedido pelo admin / Admin pode alterar pedido / Funcionário edita pedido

---

## Problem

Today, logged-in employees can only update an order's status. They cannot correct typos in customer contact details, fix mistaken item selections or customizations, change payment method or delivery type, or adjust notes.

When a customer makes a mistake (wrong phone, forgot an extra, selected delivery instead of pickup), the employee has no in-app way to fix it. They must either ask the customer to re-submit or handle it manually outside the app, which is error-prone and creates friction.

---

## Goal

Allow the admin (logged-in employee) to edit any order field that a customer can set at checkout. Success = the admin can open an order in `/admin`, modify items (add/remove, adjust quantities, change extras/removals), contact details (nome, telefone, e-mail), payment method, fulfillment type, and notes, then save — with the same validation and snapshot rules that apply to customer submissions.

---

## Who

- **Employees (burger owner / staff):** Need to correct order mistakes and update details without contacting the customer or going outside the app.
- **Customers (indirect):** Benefit when employees fix their orders quickly.
- **Developers/operators:** Must extend admin data access and DB grants; reuse customer validation where possible.

---

## What We Capture / Change

- **Admin UI (`/admin` order details):**
  - Add "Editar pedido" (or equivalent) entry point to open an edit flow.
  - Edit flow exposes all customer-editable fields: items (with menu picker, quantities, extras, removals), contact (nome, telefone, e-mail), payment method, fulfillment type, notes.
  - Admin edits use the same menu JSON as customer flow (extras, removals, pricing).
- **Admin API / server actions:**
  - New update-order path (PATCH/PUT or server action) that accepts the same payload shape as customer submit (or equivalent).
  - Reuse existing validation and snapshot logic from `submitCustomerOrderWithClient` where possible.
  - Writes via authenticated Supabase client (not service-role) to honor RLS.
- **Database / RLS:**
  - Extend `authenticated` grant on `public.orders` to allow update of: `customer_name`, `customer_email`, `customer_phone`, `payment_method`, `fulfillment_type`, `delivery_fee_cents`, `notes`, `items`.
  - Status updates remain governed by existing status-transition trigger and policy.
  - Update policy must ensure only non-deleted orders are editable (`is_deleted = false`).
- **Customer snapshot behaviour:**
  - Same rules as customer submit: server derives item snapshots (name, unitPriceCents, lineTotalCents, extras, removedIngredients) from current menu JSON.
  - Contact snapshot fields on the order are overwritten with the edited values.
- **`customer_id` linkage:**
  - Editing contact details may require re-matching or clearing `customer_id` (locked in Decisions).

---

## Success Criteria

- Admin can open an order in `/admin` and enter an edit mode (e.g. modal, slide-over, or dedicated view).
- Admin can modify items: add items from menu, remove items, change quantities, add/remove extras, add/remove ingredient removals.
- Admin can modify contact fields: nome, telefone, e-mail (with same validation as customer flow).
- Admin can modify payment method and fulfillment type.
- Admin can modify notes.
- Server validates all edits with same rules as customer submit (menu item IDs, extras, removals, phone, email, lengths).
- Server derives and persists item snapshots from current menu JSON (no client-provided snapshots).
- Delivery fee is recalculated server-side when fulfillment type changes (R$ 5,00 for entrega, 0 for retirada).
- Saving edits updates the order in Supabase; admin sees updated data immediately (or after refresh/poll).
- Status progression and status-transition integrity remain unchanged.
- Server rejects fulfillment-type changes that would violate DB constraints (e.g. change to retirada when status is `saiu_para_entrega`, or to entrega when status is `pronto_para_retirada`) with a clear pt-BR validation message.
- All new admin-facing labels and messages are in Portuguese (pt-BR).
- Only authenticated employees can access the edit flow.

---

## Non-Goals (Out of Scope)

- Customer self-service order editing (customers cannot edit their own orders after submission).
- Editing order status via the edit flow (status stays on existing status-progression controls).
- Editing `created_at`, `reference`, `id`, `customer_id`, `is_deleted`, `soft_deleted_at`.
- Delivery address capture (no address field exists today; out of scope).
- Audit log or revision history of edits.
- Bulk editing multiple orders.

---

## Acceptance Scenarios

### Happy Paths

1. **Admin corrects contact typo:** Admin opens order, edits telefone, saves. Order shows updated phone in details.
2. **Admin adds missing item:** Admin opens order, adds an item from the menu with extras, saves. Order shows new item with correct snapshot and total.
3. **Admin changes delivery to pickup:** Admin opens order (status is aguardando_confirmacao or em_preparo), changes fulfillment type from entrega to retirada, saves. Delivery fee becomes 0; order reflects retirada.
4. **Admin fixes item customization:** Admin opens order, edits an item to add "Queijo extra" and "Sem cebola", saves. Order shows updated extras and removals.
5. **Admin updates notes:** Admin opens order, edits Observações, saves. Order shows new notes.

### Unhappy Paths

1. **Invalid phone in edit:** Admin enters invalid BR phone; save is rejected with pt-BR validation message.
2. **Invalid extra/removal ID:** Admin (or tampered request) sends extra/removal ID not in menu; server rejects with validation error.
3. **Empty items:** Admin removes all items; save is rejected (same as customer submit).
4. **Unauthenticated request:** Update endpoint/action requires auth; unauthenticated requests receive 401 or equivalent.
5. **Order not found or soft-deleted:** Edit request for non-existent or soft-deleted order fails appropriately.
6. **Fulfillment-type conflicts with status:** Admin changes fulfillment to retirada while status is `saiu_para_entrega`, or to entrega while status is `pronto_para_retirada`; server rejects with pt-BR validation message.

---

## Edge Cases

- **Menu changed since order created:** Edit uses current menu JSON. Items whose `menuItemId` no longer exists in menu are rejected (see Decisions).
- **Fulfillment type change and status constraints:** When status is `saiu_para_entrega`, server rejects fulfillment change to retirada (DB requires entrega). When status is `pronto_para_retirada`, server rejects fulfillment change to entrega (DB requires non-entrega). Locked in Decisions.
- **Editing delivered orders:** Product decision: allow or disallow editing `entregue` orders. Recommend allowing for corrections; implementation can restrict if preferred.
- **`customer_id` when contact changes:** Re-match to `public.customers` on edit, or clear `customer_id` and rely on snapshot only (locked in Decisions).
- **Concurrent edits:** Two admins editing same order; last write wins. No optimistic locking in initial scope.
- **Legacy orders with old item shape:** Items without `menuItemId` are handled per Decisions (see legacy items rule).

---

## Approach (High-Level Rationale)

1. **Reuse validation and snapshot logic.** Extract or call shared validation from `submitCustomerOrderWithClient` (or equivalent) so admin edit and customer submit enforce identical rules. Avoid duplication.
2. **New admin update path.** Add server action or API route (e.g. `PATCH /api/admin/orders/[id]` or `updateOrder` action) that:
  - Requires authenticated session.
  - Loads existing order, merges edited payload, validates, builds item snapshots, and updates via Supabase.
  - Uses request-scoped Supabase client (authenticated), not privileged client.
3. **DB migration for expanded grant.** Create migration that grants `UPDATE` on `customer_name`, `customer_email`, `customer_phone`, `payment_method`, `fulfillment_type`, `delivery_fee_cents`, `notes`, `items` to `authenticated`. Keep existing status-update policy; add or adjust policy if needed so updates to these columns are allowed for `is_deleted = false` orders.
4. **Admin UI:** Add edit affordance in order details (e.g. "Editar" button). Edit view can mirror customer checkout structure (menu picker, cart, contact form, payment/fulfillment, notes) pre-filled with current order data. Reuse components from customer flow where practical.
5. **Status transition trigger.** When admin edit does not change status, trigger does nothing. When edit also changes status (if ever combined), trigger enforces transitions. For this feature, edit flow does not change status; status remains on existing controls.

---

## Decisions (Locked)

- **Edit scope:** Admin can edit all customer-editable fields: `items`, `customer_name`, `customer_email`, `customer_phone`, `payment_method`, `fulfillment_type`, `notes`. Delivery fee is derived from fulfillment type.
- **Status:** Edit flow does not change status. Status updates stay on existing status-progression UI.
- **Validation authority:** Same as customer submit — server validates menu item IDs, extras, removals, phone, email, lengths. Server derives item snapshots from current menu.
- **`customer_id` on edit:** When contact fields change, implementation may re-match to `public.customers` or clear `customer_id`; snapshot fields always reflect edited values. Exact behaviour is implementation choice; brief does not mandate.
- **Items no longer in menu:** If the edit payload contains items whose `menuItemId` no longer exists in current menu, server rejects edit with pt-BR validation error (cannot re-validate unknown items).
- **Fulfillment-type vs. status constraints:** When order status is `saiu_para_entrega`, server rejects fulfillment change to `retirada` (DB constraint requires entrega). When status is `pronto_para_retirada`, server rejects fulfillment change to `entrega` (DB constraint requires non-entrega). Return clear pt-BR validation message in both cases.
- **Legacy items without `menuItemId`:** Legacy orders may have items with only `{ name, quantity }` (no menuItemId). Such items cannot be validated against current menu. When loading an order for edit, exclude these from the editable item list; admin sees only items resolvable to current menu. Legacy-only items are omitted from the save payload. If admin saves without re-adding them, those items are dropped from the order. Admin can re-add equivalents from the menu if needed.
- **Editing delivered orders:** Allowed. Admin can correct `entregue` orders if needed.
- **Auth:** Update path requires authenticated Supabase session (employee login). No public access.
- **Language:** All new UI strings in pt-BR.

---

## Security / Operational Constraints

- Admin update must use authenticated Supabase client so RLS applies. Do not bypass RLS with service-role for admin edits.
- Validate all inputs server-side; do not trust client for snapshots, prices, or IDs.
- Grant only the columns needed for editing; do not grant update on `id`, `reference`, `created_at`, `is_deleted`, `soft_deleted_at`.
- Ensure update policy restricts to `is_deleted = false` so soft-deleted orders cannot be edited.

---

## Stage 0 Exit Gate

- Workflow routing decision is explicit and justified
- Problem is clearly defined
- Goals are concrete and testable
- Non-goals are explicitly listed
- Happy and unhappy paths are documented
- Edge cases are surfaced
- Key decisions are locked
- Major security and operational constraints are surfaced when relevant
- Approach is outlined at a high level (no code)
- Critic has approved this brief

