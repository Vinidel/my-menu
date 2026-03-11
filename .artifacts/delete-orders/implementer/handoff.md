# Stage Handoff

Feature: delete-orders
Stage: implementer
Workflow: full

---

## Files Changed

- `supabase/migrations/20260311000000_add_delete_entregue_orders_function.sql` (created)
- `docs/delete-orders.md` (updated with delivery details, setup, rollback)

---

## What Changed

Implemented the recurring deletion of delivered orders per the brief:

1. **Postgres function** `public.delete_entregue_orders_from_previous_day()`:
   - SECURITY DEFINER (runs with migration-owner privileges for DELETE)
   - Deletes from `orders` where `status = 'entregue'` and `updated_at` in previous calendar day
   - Timezone: `America/Sao_Paulo` (explicit, no server/DB default)
   - Half-open interval `[start, end)` per brief
   - Single transactional DELETE with CTE returning count
   - Returns integer count of deleted rows

2. **Cron schedule:** Manual setup documented in `docs/delete-orders.md`. Default: `5 3 * * *` (03:05 UTC = 00:05 BRT).

3. **Docs:** Setup steps, disable/re-enable, rollback, and where the function lives.

---

## Known Gaps

- Cron schedule not automated in migration (Supabase may require manual run in SQL editor; matches menu-import pattern).
- Local migration verification skipped (Docker not running); Tester should validate function behavior.

---

## Evidence

- Happy path: function deletes only `entregue` orders from previous day
- Unhappy path: single transactional delete; no partial deletes
- Edge cases: timezone explicit; half-open interval; empty result returns 0
- No out-of-scope changes

---

## Next Review Focus

1. Tester: unit test for cutoff logic; integration test calling function with seeded orders
2. Critic: review implementation against brief
3. Gate Keeper: package as `stage-1-impl`
