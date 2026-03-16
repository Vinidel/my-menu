# Stage Handoff

Feature: soft-delete-orders-history
Stage: orchestrator
Workflow: full

---

## Files Changed

- `docs/briefs/soft-delete-orders-history.md` (created)
- `.artifacts/soft-delete-orders-history/workflow-state.json` (created)
- `.artifacts/soft-delete-orders-history/orchestrator/handoff.md` (created)

---

## What Changed

Created the Stage 0 brief for replacing delivered-order hard deletion with soft deletion:
- retain delivered rows in `public.orders` for future history
- hide soft-deleted rows from operational order reads by default
- change the daily cleanup job to soft delete eligible older delivered orders instead of removing them
- explicitly supersede the existing hard-delete `delete-orders` behavior
- lock operational semantics so soft-deleted rows are non-operational and not mutable through normal admin/server flows

**Critic feedback addressed (2026-03-16):**
- Missed-run behavior is now explicit: the next successful run soft-deletes all still-eligible older `entregue` rows, not only the immediately previous day
- Operational mutation behavior is now explicit: soft-deleted rows must not be mutable through normal active-order flows

---

## Known Gaps

- The exact soft-delete schema shape is intentionally not locked here beyond “orders must support retained-but-hidden rows”; implementation can choose the most appropriate metadata shape while preserving the brief’s behavior.
- No history UI is included in this feature; retained rows stay database-only for now.
- Existing rows already hard deleted by the prior feature cannot be recovered.

---

## Evidence

- Brief created at `docs/briefs/soft-delete-orders-history.md`
- Prior hard-delete feature reviewed as the superseded baseline: `docs/briefs/delete-orders.md`, `docs/delete-orders.md`
- Workflow state initialized at `.artifacts/soft-delete-orders-history/workflow-state.json`

---

## Next Review Focus

1. Confirm the implementation fully replaces the old hard-delete cron/function instead of layering soft delete on top of it.
2. Verify every operational order read path excludes soft-deleted rows consistently.
3. Verify stale admin actions cannot mutate soft-deleted rows after cleanup.
4. Ensure the retention metadata is future-safe for history/reporting without overbuilding a history feature now.
