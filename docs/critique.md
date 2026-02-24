---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 2 test coverage review — Admin Orders Dashboard Polling (TanStack Query) (`docs/briefs/admin-orders-dashboard-polling-tanstack-query.md`)
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

## Acceptance Criteria (Stage 2 spot-check)
- [x] `GET /api/admin/orders` route is covered for success/auth/setup/query-failure paths
- [x] Hidden-tab pause + visible restore immediate refetch behavior is covered
- [x] Polling vs in-flight status mutation conflict behavior is covered
- [x] Non-destructive background polling failure behavior (keep last good data visible) is covered
- [x] pt-BR background polling failure feedback message/banner is explicitly asserted
- [x] Mobile accordion remains usable with polling enabled is explicitly asserted
---
