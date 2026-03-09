---
# Critique

Date: 2026-03-09
Reviewed by: Critic Agent
Scope: `docs/briefs/order-delivery-option.md` (Stage 0 brief)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Consider aligning `docs/briefs/order-delivery-option.md:59` with the locked legacy display rule at `docs/briefs/order-delivery-option.md:155` so “legacy behaves safely as pickup” vs “legacy displays as unknown” is spelled out more explicitly for implementers.

### Risks / Assumptions
- The feature intentionally depends on manual follow-up to capture the delivery address after order submission.
- Historical delivery-fee accuracy depends on implementation honoring the locked persistence rules for `delivery_fee_cents`.

## Acceptance Criteria
- [x] Problem and scope are aligned with the narrowed feature.
- [x] Admin visibility for fulfillment type is explicitly defined.
- [x] Delivery surcharge storage/representation is locked for historical accuracy.
- [x] Delivery field contract and canonical values are explicitly defined.
---
