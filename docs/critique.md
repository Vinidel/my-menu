---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 2 test coverage review — API Orders Anti-Abuse (`app/api/orders/route.test.ts`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Add a focused test asserting the exact `Retry-After` value shape/range (currently you assert presence only), if you want stronger regression protection around limiter timing math.
- Add a source-extraction parsing test matrix (e.g. `x-forwarded-for` comma list, IPv4 with port, `forwarded` header IPv6 form) in a future unit test for the route helper or extracted helper module.
- Consider asserting throttle-path logging uses hashed IP output (not raw IP) to lock the no-PII logging expectation.

### Risks / Assumptions
- Stage 2 currently tests route-level anti-abuse behavior, not the limiter helper in isolation. This is acceptable for the brief, but a dedicated unit test for `lib/anti-abuse/rate-limit.ts` would make future refactors safer.
- In-memory limiter state is reset in tests, but production behavior remains per-process/per-instance (already documented and acceptable for this stage).

## Acceptance Criteria (Stage 2 spot-check)
- [x] Tests cover `429` throttling after threshold
- [x] Tests cover `Retry-After` header on throttled responses
- [x] Tests verify throttled requests do not reach order creation logic
- [x] Tests cover fallback `unknown` source bucket behavior
- [x] Tests cover degrade-open behavior when limiter fails
- [x] Existing `/api/orders` status mapping tests still pass
---
