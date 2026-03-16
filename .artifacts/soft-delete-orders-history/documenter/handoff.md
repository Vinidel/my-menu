# Stage Handoff

Feature: soft-delete-orders-history
Stage: documenter
Workflow: full

---

## Files Changed
- `docs/soft-delete-orders-history.md`
- `docs/delete-orders.md`
- `docs/retrospectives/2026-03-16-soft-delete-orders-history.md`
- `PROJECT.md`
- `.artifacts/soft-delete-orders-history/documenter/handoff.md`
- `.artifacts/soft-delete-orders-history/workflow-state.json`

---

## What Changed
- Added the final PR-ready feature documentation for the soft-delete retention policy, including rollout notes, operational contract, deferred work, and legacy-entrypoint guidance.
- Replaced the stale operator-facing `docs/delete-orders.md` hard-delete guidance with an explicit compatibility note that the legacy `delete_*` function name now soft-deletes rows.
- Recorded workflow learning from superseding a destructive retention feature with a history-preserving one.
- Updated project-level status/docs inventory so the current delivered-feature list reflects the new retention policy.

---

## Known Gaps
- This workflow run still does not verify the SQL migration/function against a live Supabase/Postgres environment.
- The cleanup function name remains semantically misleading; it is documented, but not yet renamed.
- There is still no history UI, restore flow, or later purge policy for soft-deleted rows.

---

## Evidence
- Final feature doc: `docs/soft-delete-orders-history.md`
- Legacy compatibility doc: `docs/delete-orders.md`
- Retrospective: `docs/retrospectives/2026-03-16-soft-delete-orders-history.md`

---

## Next Review Focus
- Run Critic on the Stage 4 documentation package.
- Confirm the final PR body should come from `docs/soft-delete-orders-history.md`.
