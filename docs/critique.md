---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 4 hardening review — Order Item Extras / Customization (`docs/briefs/order-item-extras-customization.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- If you later add import/backfill tooling for historical orders, consider logging/counting truncated extras payloads in `/admin` parsing (or during import validation) so malformed data does not fail silently in operations.
- If extras labels become business-critical (e.g., kitchen print integration), consider preserving raw oversized values in a separate audit path instead of truncation-at-render only.

### Risks / Assumptions
- The new parser bounds protect `/admin` rendering from oversized persisted extras JSON, but they do not sanitize or repair the underlying stored data in `public.orders.items`; malformed payloads remain in the database until cleaned.
- Truncation limits are a UI resilience choice, not a schema contract. If future features depend on full extras labels/ids in historical orders, the limits may need revisiting or relocation to a more explicit data-normalization layer.

## Acceptance Criteria (Stage 4 spot-check)
- [x] Hardening change stays within extras/customization scope (`/admin` extras parsing/rendering path)
- [x] Defensive limits are implemented for persisted extras JSON parsing (array length and oversized fields)
- [x] Happy-path extras rendering remains backward-compatible (no intended behavior change to valid data)
- [x] Hardening notes document the risk, mitigation, and remaining tradeoffs
- [x] New hardening behavior is covered by tests (`lib/orders.test.ts`)
- [x] Full test suite and build pass after hardening changes
---
