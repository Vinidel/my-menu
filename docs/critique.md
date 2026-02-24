---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 5 documentation review — Admin Orders Dashboard Polling (TanStack Query) (`docs/briefs/admin-orders-dashboard-polling-tanstack-query.md`)
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

## Acceptance Criteria (Stage 5 spot-check)
- [x] Dedicated feature documentation exists (`docs/admin-orders-dashboard-polling-tanstack-query.md`)
- [x] Delivered scope matches approved brief (TanStack Query polling, protected route, visibility contract, mutation conflict rule)
- [x] Locked polling decisions are documented clearly (10s cadence, hidden-tab pause, one immediate restore refetch)
- [x] `GET /api/admin/orders` route contract and auth requirement are documented for future engineers
- [x] Stage 4 hardening behavior/tradeoffs are documented (`private, no-store`, `Vary: Cookie`, reconnect refetch disabled)
- [x] `PROJECT.md` references/status/employee flow summary include the feature
- [x] Brief status is updated to `Stage 5 — Documentation Complete (pending Critic)`
---
