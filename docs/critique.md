---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 2 test coverage review — Display Total Order Amount in Admin Order Details (`docs/briefs/admin-order-total-amount-display.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Add one mobile accordion-specific total-display assertion if you want direct coverage of desktop/mobile parity for this feature (the shared details component plus existing mobile details tests already lower this risk).
- Consider a parser/UI test for `priceCents = 0` to lock the newly approved zero-price behavior end-to-end.

### Risks / Assumptions
- Stage 2 now covers both logic-level and UI-level behavior: parser totals/fallbacks, submit-side fail-closed pricing validation, and `/admin` details rendering for priced + unavailable totals.
- The dashboard UI tests currently inject `totalAmountLabel` in fixtures for rendering assertions; parser tests separately validate `pt-BR` formatting and fallback logic. This split is acceptable and keeps UI tests less brittle.
- Historical malformed `orders.items` shapes remain a parser-hardening concern, but the fallback coverage (`Indisponível`) is in place and aligns with the brief.

## Acceptance Criteria (Stage 2 spot-check)
- [x] `/admin` order details UI renders `Total do pedido` for priced orders
- [x] `/admin` order details UI renders fallback `Indisponível` safely for legacy/unpriced orders
- [x] Admin total calculation logic is tested (base + extras, pt-BR formatting)
- [x] New customer-submitted order snapshots are tested (`unitPriceCents`, extras `priceCents`, `lineTotalCents`)
- [x] Server-side fail-closed behavior is tested for missing base/extra `priceCents`
- [x] Legacy/partial pricing fallback behavior is covered
---
