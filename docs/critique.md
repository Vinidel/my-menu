---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 0 brief review — Order Item Extras / Customization (`docs/briefs/order-item-extras-customization.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Consider locking a maximum number of extras per item (or explicitly deferring) to bound payload/UI complexity if the menu grows.
- Add one optional success criterion for how extras are shown in `Seu pedido` (e.g., chips/list under each line item) if you want less UX interpretation in Stage 1.
- If `priceCents` for extras will be shown in UI, clarify whether display-only subtotal hints are allowed without changing billing logic.

### Risks / Assumptions
- The brief now locks the client/server contract and merge semantics well enough for implementation, but `/admin` parser/display changes still need careful backward-compatible handling for historical `orders.items` shapes.
- Additive-only scope is explicit now; future requests for removals/substitutions should be treated as a follow-up feature to avoid hidden complexity.

## Acceptance Criteria (Stage 0 spot-check)
- [x] Problem/goals/non-goals are clear and product-relevant
- [x] End-to-end scope is covered (`/` customization, `/api/orders` validation, `/admin` display)
- [x] Backward-compatibility intent for `orders.items` is documented
- [x] Server-side validation authority is locked
- [x] Client submit payload shape for customized items is locked
- [x] Extras-set merge/equality normalization is locked
- [x] Scope mismatch in problem examples vs additive-only schema is resolved
- [x] Minimum `/admin` extras display format is locked for testability
---
