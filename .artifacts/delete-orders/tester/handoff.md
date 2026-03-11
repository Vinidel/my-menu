# Stage Handoff

Feature: delete-orders
Stage: tester
Workflow: full

---

## Files Changed

- `__tests__/delete-entregue-orders.test.ts` (created)

---

## What Changed

Added tests derived from the delete-orders brief acceptance scenarios:

1. **Migration content tests (8):** Assert the migration file contains required SQL patterns:
   - `status = 'entregue'` (brief: only entregue deleted)
   - `updated_at` cutoff
   - `America/Sao_Paulo` timezone
   - Half-open interval (`>= v_start` and `< v_end`)
   - Single transactional DELETE
   - SECURITY DEFINER
   - search_path = public
   - Returns count

2. **Cutoff semantics tests (5):** Validate the half-open interval and “previous day only” logic (test-only helper replicates brief semantics):
   - Start of previous day included (half-open interval start inclusive)
   - 23:59:59.999 on previous day included (midnight boundary)
   - 00:00:00 of next day excluded (end exclusive)
   - Orders from earlier than previous day excluded (legacy)
   - Orders from today excluded

**Critic improvements addressed:** Added inclusive-start test; added BRT/UTC-3 comment to cutoff helper.

---

## Known Gaps

- **No DB integration test:** The function is invoked only by pg_cron; no app code path. Full behavioral test (seed orders, call function, assert deletions) would require `supabase db reset` + Docker. Documented as integration/manual verification.
- **Cutoff helper lives in test file:** Production logic is in the migration; test helper replicates semantics for regression coverage.

---

## Evidence

- CI: `npm test` passes (207 tests, 14 in delete-entregue-orders)
- Happy paths: migration structure, cutoff logic
- Unhappy/edge: half-open interval, legacy exclusion, today exclusion
- No production code modified

---

## Next Review Focus

1. Critic: review test coverage against brief
2. Gate Keeper: package as `stage-2-tests`
