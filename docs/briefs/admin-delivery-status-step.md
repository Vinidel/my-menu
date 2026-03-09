# Feature Brief — Etapa Admin de “Saiu para entrega”

Status: Stage 0 — Framing
Date: 2026-03-09
Author: Orchestrator Agent

---

## Alternative Name

Status de entrega no admin / Fluxo admin para pedidos de entrega / Etapa `Saiu para entrega`

---

## Problem

The app already lets customers mark an order as `Entrega`, and `/admin` already shows whether an order is `Retirada` or `Entrega`. However, delivery orders still use the exact same status progression as pickup orders.

That creates an operational gap for employees: once a delivery order is prepared, there is no explicit system state to indicate that the order has left the store and is on the way to the customer.

Without a delivery-specific admin step, employees lose visibility into the real lifecycle of delivery orders, summary counts underrepresent active delivery work, and the status flow does not match how the business actually operates.

---

## Goal

Add a delivery-only admin status step `Saiu para entrega` that appears immediately before `Entregue`, and expose it both in order progression and in the `/admin` summary counts.

Success = employees can progress delivery orders through `Saiu para entrega`, pickup orders keep their existing flow unchanged, and `/admin` clearly reflects delivery orders that are out for delivery.

---

## Who

- **Employees (burger owner / staff):** Need to know when a delivery order has left the store and is still in-flight before final completion.
- **Customers (indirectly):** Benefit from fewer fulfillment mistakes because employees can track delivery progress more accurately.
- **Developers/operators:** Must preserve safe behavior for existing pickup orders, existing delivery orders created before this status exists, and legacy rows with older status values.

---

## What We Capture / Change

- **Admin order status model:**
  - Add a new canonical persisted status for delivery progression
  - Keep pickup progression unchanged
- **Admin order progression rules (`/admin`):**
  - Delivery orders gain an extra forward-only step before `Entregue`
  - Pickup orders continue using the current progression without the new step
- **Admin summary counts (`/admin`):**
  - Add a top summary card for `Saiu para entrega`
  - Count only orders currently in that status
- **Admin list/details display:**
  - Show the new pt-BR label when a delivery order reaches that state
  - Keep unknown/legacy status fallback behavior safe
- **Persistence / DB integrity:**
  - Extend the allowed order status set so the new canonical status can be stored safely
  - Update transition enforcement so only delivery orders can enter the new step
- **Legacy row handling:**
  - Existing orders already marked `entregue` remain valid with no backfill requirement
  - Existing delivery orders in older statuses can continue forward safely under the new rules

---

## Success Criteria

- [ ] `/admin` adds a visible summary card for `Saiu para entrega`.
- [ ] Delivery orders progress forward as `Esperando confirmação` -> `Em preparo` -> `Saiu para entrega` -> `Entregue`.
- [ ] Pickup orders continue progressing as `Esperando confirmação` -> `Em preparo` -> `Entregue`.
- [ ] Delivery-aware admin status ordering is locked and consistent in `/admin` as `Esperando confirmação` -> `Em preparo` -> `Saiu para entrega` -> `Entregue` for summary cards and status-first sorting.
- [ ] Employees can only advance one step at a time; no reverse movement or skipping.
- [ ] The new status is persisted using a locked canonical value and displayed in pt-BR as `Saiu para entrega`.
- [ ] Delivery orders already in progress before rollout continue to render and progress safely.
- [ ] Pickup orders never enter the delivery-only status through normal admin progression.
- [ ] Invalid/manual attempts to assign the delivery-only status to pickup orders are rejected safely in the update path and DB integrity layer.
- [ ] Existing polling, sorting, and optimistic/pending admin behavior remain correct with the extra delivery status.
- [ ] All new employee-facing labels/messages remain in Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Customer-facing delivery tracking or notifications.
- Capturing delivery address in this feature.
- Assigning drivers or storing courier identity.
- ETA / estimated delivery time promises.
- Route management, dispatching, or delivery zones.
- Changing pickup-order behavior beyond preserving the current flow.
- Reopening delivered orders, cancelling orders, or arbitrary status jumps.
- Admin editing of delivery fee or fulfillment type.

---

## Acceptance Scenarios

### Happy Paths

1. **Employee progresses a delivery order to out-for-delivery.** A delivery order in `Em preparo` is opened in `/admin`. Employee clicks the progress action, and the order status updates to `Saiu para entrega`.
2. **Employee completes a delivery order after out-for-delivery.** A delivery order in `Saiu para entrega` is progressed, and the order status updates to `Entregue`.
3. **Employee progresses a pickup order with unchanged flow.** A pickup order in `Em preparo` is progressed, and it goes directly to `Entregue` without passing through `Saiu para entrega`.
4. **Employee sees delivery work in summary counts.** `/admin` summary shows a separate `Saiu para entrega` card, and orders in that status contribute only to that count.
5. **Employee sees correct status labels in list/details.** A delivery order currently out for delivery shows `Saiu para entrega` consistently in the admin UI.

### Unhappy Paths

1. **Pickup order attempts delivery-only step.** A pickup order is manually or incorrectly targeted for the delivery-only status; the system rejects the transition safely and preserves a valid persisted state.
2. **Unknown/legacy status value.** An order row contains an unsupported status value; `/admin` still renders safely with fallback behavior and does not crash.
3. **Concurrent employee update.** One employee advances the order first; a second stale progression attempt is rejected, and the UI reloads the current persisted status.
4. **Status update fails.** The admin progression request fails due to API/DB error; employee sees a pt-BR error and the order remains at the persisted status.

---

## Edge Cases

- **Legacy delivered orders:** Existing orders already in `entregue` remain valid and do not require backfill through the new delivery-only step.
- **Legacy delivery orders mid-flow:** Existing delivery orders currently in `aguardando_confirmacao` or `em_preparo` should continue forward into the new flow safely after rollout.
- **Legacy pickup orders:** Existing pickup orders must continue using the old two-step progression with no behavior change.
- **Manual DB tampering:** If someone manually writes `saiu_para_entrega` to a pickup order, the system must reject or fail safely rather than treating it as valid.
- **Polling reorder behavior:** Adding the new status must not break admin polling refresh, list ordering, or pending-row merge behavior.
- **Summary totals:** The added status card must not double-count orders already shown in other summary states.
- **Unknown fulfillment on old rows:** Orders with missing or unknown `fulfillment_type` must not be incorrectly forced into the delivery-only flow.

---

## Approach (High-Level Rationale)

1. **Model delivery lifecycle explicitly.** Delivery orders have a real operational step between preparation and completion, so the status model should represent it directly instead of overloading `Entregue`.
2. **Branch progression by fulfillment type.** The extra step belongs only to delivery orders; pickup orders should keep their simpler flow to avoid unnecessary admin friction.
3. **Preserve forward-only status rules.** Keep the current one-direction progression model, but make the “next status” calculation dependent on both current status and fulfillment type.
4. **Align dashboard visibility with operations.** Add a dedicated summary bucket for `Saiu para entrega` so the top-level admin view reflects active delivery work, and keep the operational display order explicit as `Esperando confirmação` -> `Em preparo` -> `Saiu para entrega` -> `Entregue`.
5. **Keep rollout backward-compatible.** Existing orders should remain readable and safely progressive without requiring historical status backfills.
6. **Enforce invariants beyond the UI.** UI rules alone are insufficient; the persisted status contract and DB transition rules should prevent pickup orders from entering the delivery-only state.

---

## Decisions (Locked)

- **New pt-BR status label (locked):** `Saiu para entrega`.
- **New canonical persisted status (locked):** `saiu_para_entrega`.
- **Delivery-only progression (locked):** Delivery orders progress as `aguardando_confirmacao` -> `em_preparo` -> `saiu_para_entrega` -> `entregue`.
- **Pickup progression (locked):** Pickup orders continue progressing as `aguardando_confirmacao` -> `em_preparo` -> `entregue`.
- **Status placement:** `Saiu para entrega` appears immediately before `Entregue`.
- **Admin summary scope (locked):** `/admin` summary adds a separate card for `Saiu para entrega`.
- **Admin operational display order (locked):** When `/admin` shows status-first summaries or list ordering, the canonical order is `Esperando confirmação` -> `Em preparo` -> `Saiu para entrega` -> `Entregue`.
- **Applicability rule:** Only orders with `fulfillment_type = 'entrega'` may enter `saiu_para_entrega`.
- **Unknown fulfillment fallback:** Orders with missing/unknown fulfillment data must not be treated as delivery orders for progression purposes.
- **Forward-only policy:** Employees may only advance to the next allowed status; no backward transitions or jumps are introduced in this feature.
- **Legacy completion policy:** Existing orders already in `entregue` remain valid and are not backfilled.
- **Sorting/display expectation:** Existing admin sorting and display patterns must continue working with the added status.
- **Language:** All new labels/messages remain pt-BR.
- **Migration filenames:** Use full timestamp prefixes (`YYYYMMDDHHMMSS_*`) for new Supabase migrations.

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
