---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 2 test coverage review — Order Item Extras / Customization (`docs/briefs/order-item-extras-customization.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Consider adding one route-level `/api/orders` test that passes `extraIds` through the HTTP layer (not only `submitCustomerOrderWithClient(...)`) if you want tighter end-to-end payload-contract regression protection.
- Add an explicit legacy-order parsing assertion for unknown historical extras payload shapes in `/admin` if you expect manual JSON edits/imports in the future.

### Risks / Assumptions
- Stage 2 coverage strongly validates the locked additive-extras flow, but UI rendering variations in `Seu pedido` (layout-only changes) may still cause brittle selector assertions over time.
- Existing non-extras order submission and `/admin` regression coverage is assumed to remain in the broader test suite (and currently passes).

## Acceptance Criteria (Stage 2 spot-check)
- [x] Customer extras selection/edit flow has direct UI coverage on `/`
- [x] Locked submit payload shape (`menuItemId`, `quantity`, `extraIds?`) is asserted
- [x] Tampered/invalid `extraIds` are rejected by server-side validation tests
- [x] Extras-set normalization/merge behavior is covered (dedupe + sort + merge)
- [x] Server-derived extras snapshot persistence in `orders.items` is asserted
- [x] `/admin` details render `Extras:` for customized items
- [x] Existing suite still passes (no evident regression introduced by extras feature tests)
---
