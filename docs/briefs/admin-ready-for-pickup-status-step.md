# Feature Brief — Etapa Admin de “Pronto para retirada”

Status: Stage 0 — Framing
Date: 2026-03-09
Author: Orchestrator Agent

---

## Alternative Name

Status de retirada no admin / Fluxo admin para pedidos de retirada / Etapa `Pronto para retirada`

---

## Problem

The app now models delivery orders with a dedicated in-between operational step: `Saiu para entrega`. Pickup orders, however, still jump directly from `Em preparo` to `Entregue`.

That leaves the pickup lifecycle less explicit than the delivery lifecycle. For employees, there is no system state that means “the order is ready and waiting at the store, but has not yet been collected.” As a result, pickup work in progress is underrepresented in `/admin`, the lifecycle is asymmetric between delivery and pickup, and employees lose visibility into orders that are complete operationally but not yet handed off to the customer.

Without a pickup-side parallel step, the dashboard cannot distinguish “still being prepared” from “ready and waiting for collection,” and the admin flow does not match how pickup orders are actually fulfilled.

---

## Goal

Add a pickup-only admin status step `Pronto para retirada` that appears immediately before `Entregue`, in parallel with delivery-only `Saiu para entrega`, and expose it in both `/admin` progression and summary counts.

Success = pickup orders progress through `Pronto para retirada`, delivery orders keep their existing `Saiu para entrega` flow unchanged, and `/admin` clearly distinguishes ready-for-pickup work from out-for-delivery work.

---

## Who

- **Employees (burger owner / staff):** Need to know when a pickup order is ready and waiting, separately from orders still being cooked and separately from delivery orders already on the road.
- **Customers (indirectly):** Benefit from fewer handoff mistakes because staff can track pickup-ready orders explicitly.
- **Developers/operators:** Must preserve safe behavior for the already-shipped delivery status flow, existing pickup orders, and legacy rows with missing or unsupported status/fulfillment values.

---

## What We Capture / Change

- **Admin order status model:**
  - Add a new canonical persisted status for pickup progression
  - Preserve the existing delivery-only status already shipped
- **Admin order progression rules (`/admin`):**
  - Pickup orders gain an extra forward-only step before `Entregue`
  - Delivery orders keep their current progression unchanged
- **Admin summary counts (`/admin`):**
  - Add a top summary card for `Pronto para retirada`
  - Count only orders currently in that status
- **Admin list/details display:**
  - Show the new pt-BR label when a pickup order reaches that state
  - Keep unknown/legacy status fallback behavior safe
- **Persistence / DB integrity:**
  - Extend the allowed order status set so the new canonical pickup status can be stored safely
  - Update transition enforcement so only pickup/known-non-delivery orders can enter the new step
- **Legacy row handling:**
  - Existing orders already marked `entregue` remain valid with no backfill requirement
  - Existing pickup orders in older statuses can continue forward safely under the new rules

---

## Success Criteria

- [ ] `/admin` adds a visible summary card for `Pronto para retirada`.
- [ ] Pickup orders progress forward as `Esperando confirmação` -> `Em preparo` -> `Pronto para retirada` -> `Entregue`.
- [ ] Delivery orders continue progressing as `Esperando confirmação` -> `Em preparo` -> `Saiu para entrega` -> `Entregue`.
- [ ] Admin operational status ordering is locked and consistent in `/admin` as `Esperando confirmação` -> `Em preparo` -> `Pronto para retirada` -> `Saiu para entrega` -> `Entregue` for summary cards and status-first sorting.
- [ ] Employees can only advance one step at a time; no reverse movement or skipping.
- [ ] The new pickup status is persisted using a locked canonical value and displayed in pt-BR as `Pronto para retirada`.
- [ ] Existing pickup orders already in progress before rollout continue to render and progress safely.
- [ ] Delivery orders never enter the pickup-only status through normal admin progression.
- [ ] Invalid/manual attempts to assign the pickup-only status to delivery orders are rejected safely in the update path and DB integrity layer.
- [ ] Legacy rows with missing/unknown `fulfillment_type` are interpreted as pickup flow for progression purposes and may enter `Pronto para retirada`.
- [ ] Existing polling, sorting, and optimistic/pending admin behavior remain correct with both parallel in-between statuses.
- [ ] All new employee-facing labels/messages remain in Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Customer-facing pickup-ready notifications.
- Pickup scheduling, appointment windows, or queue numbers.
- Capturing pickup person identity or verification codes.
- Merging the pickup and delivery intermediate steps into one shared generic status.
- Changing delivery-order behavior beyond preserving the current `Saiu para entrega` flow.
- Reopening delivered orders, cancelling orders, or arbitrary status jumps.
- Admin editing of fulfillment type, delivery fee, or payment data in this feature.

---

## Acceptance Scenarios

### Happy Paths

1. **Employee progresses a pickup order to ready-for-pickup.** A pickup order in `Em preparo` is opened in `/admin`. Employee clicks the progress action, and the order status updates to `Pronto para retirada`.
2. **Employee completes a pickup order after ready-for-pickup.** A pickup order in `Pronto para retirada` is progressed, and the order status updates to `Entregue`.
3. **Employee progresses a delivery order with unchanged flow.** A delivery order in `Em preparo` is progressed, and it still goes to `Saiu para entrega`, not to the pickup-only step.
4. **Employee sees pickup-ready work in summary counts.** `/admin` summary shows a separate `Pronto para retirada` card, and pickup orders in that status contribute only to that count.
5. **Employee sees correct status labels in list/details.** A pickup order currently ready for collection shows `Pronto para retirada` consistently in the admin UI.

### Unhappy Paths

1. **Delivery order attempts pickup-only step.** A delivery order is manually or incorrectly targeted for the pickup-only status; the system rejects the transition safely and preserves a valid persisted state.
2. **Unknown/legacy status value.** An order row contains an unsupported status value; `/admin` still renders safely with fallback behavior and does not crash.
3. **Unknown fulfillment on old rows.** An order row has missing/unsupported `fulfillment_type`; the system interprets it as pickup flow, allows `Pronto para retirada`, and must never route it into `Saiu para entrega`.
4. **Concurrent employee update.** One employee advances the order first; a second stale progression attempt is rejected, and the UI reloads the current persisted status.
5. **Status update fails.** The admin progression request fails due to API/DB error; employee sees a pt-BR error and the order remains at the persisted status.

---

## Edge Cases

- **Already-shipped delivery flow:** Existing delivery orders must keep `saiu_para_entrega` behavior unchanged.
- **Legacy pickup orders mid-flow:** Existing pickup orders currently in `aguardando_confirmacao` or `em_preparo` should continue forward into the new pickup flow safely after rollout.
- **Legacy unknown-fulfillment rows:** Orders with missing or unsupported `fulfillment_type` are treated as pickup-flow rows for progression purposes.
- **Legacy delivered orders:** Existing orders already in `entregue` remain valid and do not require backfill through the new pickup-only step.
- **Manual DB tampering:** If someone manually writes `pronto_para_retirada` to a delivery order, the system must reject or fail safely rather than treating it as valid.
- **Summary totals:** Adding the new pickup card must not double-count orders already shown in other summary states.
- **Polling reorder behavior:** Adding a second intermediate status must not break admin polling refresh, list ordering, or pending-row merge behavior.
- **Operational ordering symmetry:** Pickup-ready and out-for-delivery are parallel operational states, but the dashboard must still use one explicit deterministic global order.

---

## Approach (High-Level Rationale)

1. **Model pickup lifecycle explicitly.** Pickup orders, like delivery orders, have a meaningful intermediate operational state between preparation and completion.
2. **Keep branching by fulfillment type.** Delivery and pickup should each use their own intermediate step, rather than overloading one status for both.
3. **Preserve forward-only status rules.** Continue the current one-direction progression model, but make the next-step calculation depend on both current status and fulfillment type.
4. **Align dashboard visibility with operations.** Add a dedicated summary bucket for pickup-ready work so the admin dashboard reflects what staff actually need to hand off in-store.
5. **Maintain backward compatibility.** Existing rows must remain readable and safely progressive without historical backfill.
6. **Enforce invariants beyond the UI.** UI rules alone are insufficient; the persisted status contract and DB transition rules should prevent delivery orders from entering the pickup-only step and preserve the existing delivery-only guardrails.

---

## Decisions (Locked)

- **New pt-BR pickup status label (locked):** `Pronto para retirada`.
- **New canonical persisted pickup status (locked):** `pronto_para_retirada`.
- **Pickup-only progression (locked):** Pickup orders progress as `aguardando_confirmacao` -> `em_preparo` -> `pronto_para_retirada` -> `entregue`.
- **Delivery progression (locked):** Delivery orders continue as `aguardando_confirmacao` -> `em_preparo` -> `saiu_para_entrega` -> `entregue`.
- **Status placement:** `Pronto para retirada` appears immediately before `Entregue` for pickup orders, parallel to delivery-only `Saiu para entrega`.
- **Admin summary scope (locked):** `/admin` summary adds a separate card for `Pronto para retirada`.
- **Admin operational display order (locked):** `Esperando confirmação` -> `Em preparo` -> `Pronto para retirada` -> `Saiu para entrega` -> `Entregue`.
- **Applicability rule:** Only non-delivery orders may enter `pronto_para_retirada`.
- **Delivery guardrail:** Orders with `fulfillment_type = 'entrega'` may not enter `pronto_para_retirada`.
- **Unknown fulfillment fallback (locked):** Missing/unknown fulfillment data is interpreted as pickup flow and may enter `pronto_para_retirada`, but must never enter `saiu_para_entrega`.
- **Forward-only policy:** Employees may only advance to the next allowed status; no backward transitions or jumps are introduced in this feature.
- **Legacy completion policy:** Existing orders already in `entregue` remain valid and are not backfilled.
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
