# Feature Brief — Opção de Entrega no Pedido

Status: Stage 0 — Framing
Date: 2026-03-09
Author: Orchestrator Agent

---

## Alternative Name

Entrega no checkout / Pedido para entrega / Delivery flag no pedido

---

## Problem

Customers can currently place an order, but there is no structured way to indicate whether the order is for delivery instead of the default pickup flow. This creates ambiguity for employees when reviewing new orders, because they cannot reliably distinguish pickup orders from delivery orders in the system.

The current flow also does not account for the business rule that delivery orders should cost more than pickup orders.

Without a first-class delivery indicator, delivery handling depends on informal communication and creates risk of wrong fulfillment expectations and incorrect totals.

---

## Goal

Add a customer-facing option to mark an order as delivery during checkout, persist that choice on the order, and add a fixed `R$ 5,00` delivery fee to delivery orders.

Success = customer can explicitly choose delivery, the server persists the delivery choice, and delivery orders include the fixed extra fee in their total.

---

## Who

- **Customers (public users):** Need a simple way to indicate that the order should be delivered instead of picked up.
- **Employees (burger owner / staff):** Need to identify whether a new order is pickup or delivery when reviewing it in `/admin`.
- **Developers/operators:** Must preserve compatibility with existing pickup orders and legacy rows that predate the delivery field/fee behavior.

---

## What We Capture / Change

- **Customer checkout UI (`/` / `Carrinho` flow):**
  - Add a customer-facing control to choose whether the order is for delivery
  - Default behavior remains pickup unless the customer explicitly selects delivery
- **Customer submission payload (`/api/orders` + shared submit logic):**
  - Include a delivery flag in the server input contract
  - Validate server-side and do not trust arbitrary client fee calculations
- **Orders persistence:**
  - Store whether the order is for delivery as a first-class order attribute
  - Ensure new delivery orders can be distinguished from pickup orders
- **Order pricing / totals:**
  - Apply a fixed delivery surcharge of `R$ 5,00` (`500` cents) to delivery orders only
  - Preserve server authority for all pricing and total calculations
- **Employee dashboard (`/admin`):**
  - Show whether the order is `Retirada` or `Entrega` in order details
  - Keep the existing admin status progression unchanged in this feature
- **Legacy row handling:**
  - Existing orders without a delivery flag must continue behaving safely as pickup orders unless explicitly defined otherwise

---

## Success Criteria

- [ ] Customer checkout includes a clear pt-BR option to mark the order as delivery.
- [ ] Customer can submit a normal pickup order without interacting with the delivery option.
- [ ] When customer selects delivery, the submit payload includes the locked delivery field and the server persists it on the order.
- [ ] Delivery fee is fixed at `R$ 5,00` and is added only to delivery orders.
- [ ] Delivery fee is derived/validated server-side and cannot be altered by client tampering.
- [ ] New delivery orders are distinguishable from pickup orders in persisted order data.
- [ ] `/admin` order details show whether the order is `Retirada` or `Entrega` for new orders.
- [ ] Existing admin status progression behavior remains unchanged in this feature.
- [ ] Existing submission behavior (items, extras, removals, payment method, anti-abuse, CAPTCHA, optional email) remains unaffected except for the intentional delivery additions.
- [ ] Existing legacy orders render and progress safely after the feature is introduced.
- [ ] All new user-facing labels/messages remain in Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Capturing delivery address in this feature.
- Capturing delivery instructions, neighborhood, ZIP code, or map pin.
- Changing the admin order status flow.
- Adding an `out for delivery` status.
- Assigning delivery drivers or route management.
- Calculating variable delivery fees by distance, area, or order value.
- Collecting estimated delivery time promises.
- Admin-side editing of delivery address/details.
- In-app customer communication about delivery progress.

---

## Acceptance Scenarios

### Happy Paths

1. **Customer submits pickup order.** Customer leaves the delivery option unselected/defaulted to pickup, submits successfully, and the order is created with no delivery fee and the normal pickup status flow.
2. **Customer submits delivery order.** Customer marks the order as delivery, submits successfully, and the order is created with the persisted delivery attribute and the fixed `R$ 5,00` surcharge.
3. **Employee sees fulfillment type in admin.** Employee opens the new order in `/admin` details and sees whether it is `Retirada` or `Entrega`.
4. **Employee sees unchanged admin workflow.** After a delivery order is created, employee handling in `/admin` continues using the current status flow with no delivery-specific stage added in this feature.

### Unhappy Paths

1. **Tampered client fee.** Client attempts to submit a manipulated delivery fee or total; server ignores/rejects tampered values and applies only the locked server-side surcharge rules.
2. **Tampered fulfillment value.** Client sends an invalid value for the fulfillment field; server rejects the submission with a Portuguese validation error and does not create the order.
3. **Legacy order without delivery field.** `/admin` opens an older order created before this feature; it renders safely and follows the locked legacy interpretation.
4. **Admin status flow unchanged.** Delivery orders do not introduce a new status stage in `/admin` during this feature rollout.

---

## Edge Cases

- **Legacy rows:** Existing orders may not have the new delivery field and must remain readable and operable.
- **Manual/unknown DB values:** If a row contains an unexpected delivery field value, the system must fail safely with deterministic behavior rather than breaking admin UI/status parsing.
- **Backward-compatible totals:** Historical orders without delivery metadata or surcharge data must not display misleading recalculated totals.
- **Polling refreshes:** Delivery flag/totals behavior must stay stable during admin polling refreshes and reordering.
- **Duplicate submits:** Existing submit protections must continue to prevent duplicate orders regardless of delivery selection.
- **No address captured:** Delivery orders are intentionally allowed without address capture in this feature because address collection happens later during employee confirmation with the customer.

---

## Approach (High-Level Rationale)

1. **Introduce a first-class fulfillment attribute.** Store delivery intent on the order itself instead of inferring it from notes, because delivery affects pricing and employee handling.
2. **Keep server authority over money.** The client may indicate delivery intent, but the server determines whether the fixed surcharge applies and persists pricing-related data accordingly.
3. **Preserve operational simplicity.** Do not collect address yet; this feature only captures delivery intent, matching the current business process where staff confirm details afterward.
4. **Defer status workflow changes.** Keep admin status progression unchanged in this feature and handle delivery-specific lifecycle changes in a later brief.
5. **Favor backward compatibility.** Legacy orders should remain valid and safe without requiring historical backfill before rollout.

---

## Decisions (Locked)

- **Customer capability:** Customers can explicitly mark an order as delivery during checkout.
- **Customer UI control:** Use a required fulfillment choice with exactly two visible pt-BR options: `Retirada` and `Entrega`.
- **Default behavior:** `Retirada` is preselected unless the customer explicitly changes to `Entrega`.
- **Address capture policy:** No delivery address is collected in this feature.
- **Operational assumption:** Employees obtain the delivery address/details later when confirming the order with the customer.
- **Delivery fee (locked):** Fixed `R$ 5,00` (`500` cents) added only to delivery orders.
- **Pricing authority:** Delivery fee is determined server-side; client-sent totals/fees are not trusted.
- **Customer submit payload contract (locked):**
  - field name: `fulfillmentType`
  - allowed canonical values: `retirada`, `entrega`
- **Persistence target:** Fulfillment type is stored as a first-class attribute on `public.orders`.
- **Persistence shape (locked):**
  - `public.orders.fulfillment_type text null`
  - `public.orders.delivery_fee_cents integer null`
- **Persistence rules (locked):**
  - `fulfillment_type = 'retirada'` => `delivery_fee_cents = 0`
  - `fulfillment_type = 'entrega'` => `delivery_fee_cents = 500`
- **Historical pricing policy:** The delivery surcharge must be persisted per order so historical totals remain accurate even if business rules change later.
- **DB integrity policy:** Add DB-level constraints so non-null `fulfillment_type` values are limited to `retirada` or `entrega`, and `delivery_fee_cents` cannot be negative.
- **Admin visibility (locked):** `/admin` order details display `Tipo de entrega` with the label `Retirada` or `Entrega`.
- **Admin fallback display (locked):** Legacy or unknown admin values display `Tipo de entrega: Não informado`.
- **Legacy interpretation:** Orders created before this feature that have no fulfillment attribute are treated as legacy/unknown for display and must not receive a retroactive delivery fee.
- **Status flow policy:** Admin status progression remains unchanged in this feature.
- **Future scope note:** Any delivery-specific status such as `out for delivery` will be handled in a separate feature after this one is merged.
- **Language:** All new labels/messages are pt-BR.
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
- [x] Critic has approved this brief
