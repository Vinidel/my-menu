---
# Critique

Date: 2026-02-23
Reviewed by: Critic Agent
Scope: Stage 0 brief review (second pass) — `docs/briefs/customer-order-submission.md`
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Consider locking the minimum `public.customers` schema fields explicitly in the brief (e.g. `id`, `name`, `email`, `phone`, `created_at`, `updated_at`) if you want tighter Stage 2 migration/schema tests.
- Consider defining a minimum menu JSON schema in Stage 0 (`id`, `name`, optional `description`, optional `price`) to reduce implementation/test drift in menu rendering.

### Risks / Assumptions
- The brief assumes `public.orders.customer_id` can remain nullable for legacy rows without impacting future reporting needs; a backfill brief may still be needed before enforcing non-null.
- The dedupe rule is now deterministic (email lowercased + trimmed, phone digits-only), but duplicate customers may still occur if users legitimately change phone/email combinations over time; that is acceptable for current scope.
- Adding `customers` plus `orders.customer_id` increases migration complexity (table create + alter existing table + app write path), but the brief now explicitly sequences this work and should prevent Stage 1 drift.

## Acceptance Criteria
- [x] Brief locks exact `orders.customer_id` linkage schema (type, FK target, nullability)
- [x] Brief defines migration compatibility strategy for existing `orders` rows
- [x] Brief defines deterministic customer dedupe normalization rules (email/phone)
- [x] (Optional) Success criteria explicitly include order snapshot field persistence alongside customer link
---
