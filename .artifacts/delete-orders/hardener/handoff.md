# Stage Handoff

Feature: delete-orders
Stage: hardener
Workflow: full

---

## Files Changed

- `supabase/migrations/20260311000000_add_delete_entregue_orders_function.sql` (modified)
- `docs/hardening-notes.md` (added delete-orders section)

---

## What Changed

### Production code

1. **Timezone robustness:** Replaced `current_date` with `(now() at time zone 'America/Sao_Paulo')::date` so the previous-day cutoff is independent of session/connection timezone (Critic Stage 1 suggestion).
2. **Observability:** Added `RAISE NOTICE 'delete_entregue_orders_from_previous_day: % rows deleted', v_deleted` so Supabase/postgres logs capture the deletion count when pg_cron runs.

### Documentation

- Added "Recurring Deletion of Delivered Orders (delete-orders) — Stage 3" section to `docs/hardening-notes.md` covering security, dependencies, performance, observability, and resilience.

---

## Known Gaps

- No automated verification that pg_cron is configured after migration; manual setup step in docs.
- If function throws, pg_cron logs the error; no retry logic (acceptable for daily cadence).

---

## Evidence

- All 207 tests pass.
- No behaviour change to public API or user flows.
- Structural/hardening improvements only; tests unchanged.

---

## Next Review Focus

1. Critic: review hardening changes
2. Gate Keeper: package as `stage-3-hardening`
