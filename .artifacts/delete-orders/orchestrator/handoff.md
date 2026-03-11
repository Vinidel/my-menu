# Stage Handoff

Feature: delete-orders
Stage: orchestrator
Workflow: full

---

## Files Changed

- `docs/briefs/delete-orders.md` (created)
- `docs/requests/delete-orders.md` (source request; unchanged)

---

## What Changed

Created the feature brief for recurring deletion of delivered orders:
- Runs once per day
- Deletes orders with `status = 'entregue'` from the previous calendar day only
- Uses `updated_at` in `America/Sao_Paulo` for cutoff
- Prefers Postgres function + pg_cron; Edge Function acceptable

**Critic feedback addressed (2026-03-11):**
- FK direction: clarified that no cascade from orders to customers; deleting orders removes only order rows
- Cron timezone: added note that pg_cron runs in UTC; convert BRT to UTC when configuring
- Midnight boundary: clarified half-open interval `[start_of_day, end_of_day)`

---

## Known Gaps

- Exact cron schedule (e.g. 00:05 vs 01:00 BRT) left to implementer

---

## Evidence

- Brief passes Stage 0 exit gate (except Critic approval)
- Request source: `docs/requests/delete-orders.md`

---

## Next Review Focus

1. Implementer: migration for delete function (if Postgres path) or Edge Function; pg_cron schedule
2. Tester: unit tests for cutoff logic; integration test for deletion behavior
3. Critic: review brief before Stage 1 handoff
