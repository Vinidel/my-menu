---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 1 implementation review — Admin Orders Dashboard Polling (TanStack Query) (`docs/briefs/admin-orders-dashboard-polling-tanstack-query.md`)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Add Stage 2 route tests for `GET /api/admin/orders` (`200`, `401`, `503`, `500`) before UI polling tests so the authenticated polling path is locked independently.
- Consider documenting the chosen TanStack Query `staleTime` and retry policy in `docs/implementation-notes.md` (even if default/zero) to keep future polling behavior changes intentional.

### Risks / Assumptions
- Polling plus status-first sorting can still move rows after successful mutations/polls; this is within brief scope, but UX polish around scroll anchoring/animation remains out of scope.
- Stage 1 correctly chose the brief-preferred **Option A** (`GET /api/admin/orders`) and returns parsed dashboard payloads, which reduces client parsing duplication and aligns with the locked implementation bias.

## Acceptance Criteria (Stage 1 spot-check)
- [x] TanStack Query is integrated for `/admin` polling state
- [x] Preferred Option A path is implemented (`GET /api/admin/orders`) with authenticated server-side read
- [x] Existing `/admin` sorting/mobile accordion/status progression behavior appears preserved
- [x] In-flight status mutation conflict handling is implemented (local pending state preserved for target order)
- [x] Background polling failures are non-destructive (keeps last data visible + error banner)
- [x] Hidden-tab pause + single immediate visibility-restore refetch behavior is fully deterministic (`refetchOnWindowFocus: false` + manual visibility restore refetch)
---
