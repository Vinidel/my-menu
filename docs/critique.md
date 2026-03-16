# Critique

Date: 2026-03-16
Reviewed by: Critic Agent
Scope: Stage 2 tests for `soft-delete-orders-history`
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- If a DB-backed test harness becomes practical later, add one focused integration check for the migration/function so `is_deleted` / `soft_deleted_at` consistency and catch-up soft deletion are proven against real SQL execution, not only mocked app-layer behavior.

### Risks / Assumptions
- Stage 2 intentionally locks the app-layer operational contract with mocked boundary tests; it does not prove the SQL migration/function behavior in a real Postgres environment yet.
- `docs/delete-orders.md` still documents the superseded hard-delete behavior and remains a documentation risk for later stages, though not a Stage 2 behavioral test blocker.

## Acceptance Criteria
- [x] Stage 2 adds regression coverage for active-row filtering with `is_deleted = false` at the shared admin/orders data-access boundary.
- [x] Stage 2 adds regression coverage for rejecting progression of missing/non-operational rows in the admin status action.
- [x] Targeted Vitest suites pass for the new coverage.
- [x] No production code was modified during this Stage 2 pass.
- [x] Remaining DB-level verification gaps are explicitly documented in the tester handoff.
