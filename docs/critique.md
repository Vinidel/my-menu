---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 4 hardening review — Admin Orders Dashboard Polling (TanStack Query) (`docs/briefs/admin-orders-dashboard-polling-tanstack-query.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Add one explicit test for auth-expired polling route handling in the dashboard fetch path (e.g. mocked `401`) if you want a clearer link between route behavior and UI resilience assumptions.
- Consider a small helper for polling test setup (fake timers + visibility + fetch stubs) to keep the new tests easier to maintain as polling features grow.

### Risks / Assumptions
- Polling plus status-first sorting can still move rows after successful mutations/polls; this is within brief scope, but UX polish around scroll anchoring/animation remains out of scope.
- Stage 1 correctly chose the brief-preferred **Option A** (`GET /api/admin/orders`) and returns parsed dashboard payloads, which reduces client parsing duplication and aligns with the locked implementation bias.
- The Stage 2 suite now covers both non-destructive background failures and polling-specific feedback, but TanStack Query timing behavior can still make polling tests brittle across library upgrades; keep assertions focused on the brief contract.

## Acceptance Criteria (Stage 4 spot-check)
- [x] Hardening changes stay within polling feature scope (`GET /api/admin/orders` + client polling behavior)
- [x] Authenticated polling route responses now use stronger cache/privacy headers (`private, no-store` + `Vary: Cookie`)
- [x] Polling determinism is improved without changing the brief-locked cadence/visibility contract (`refetchOnReconnect: false`)
- [x] Hardening notes document the security/resilience tradeoffs and residual risks
- [x] Hardening changes are covered by updated tests (route header assertions) and broader polling tests still pass
- [x] Full test suite and build pass after hardening changes
---
