---
# Critique

Date: 2026-03-11
Reviewed by: Critic Agent
Scope: delete-orders Stage 1 — Implementer (migration, docs, handoff)
Verdict: APPROVE

## Findings

### Required Changes

None.

### Suggested Improvements

- **Migration (line 18–20) — Timezone robustness:** The implementation uses `current_date` which depends on the session timezone. For maximum resilience against "Timezone drift" (brief Unhappy Path 3), derive "previous day" from Brazil time explicitly: `v_start := (((now() at time zone 'America/Sao_Paulo')::date - interval '1 day')::date at time zone 'America/Sao_Paulo');` This makes the cutoff independent of connection/session timezone. Non-blocking; current logic is correct when Supabase uses UTC.
- **Observability:** Brief says "Log or emit count of deleted rows when possible." The function returns the count; pg_cron does not log return values by default. Consider adding `RAISE NOTICE 'delete_entregue_orders_from_previous_day: % rows deleted', v_deleted;` so Supabase logs capture the count. Optional; return value suffices for manual invocation.

### Risks / Assumptions

- **Function executable by pg_cron only:** No `GRANT EXECUTE` was added; only owner/superuser can call the function. pg_cron runs in DB context with sufficient privileges. Correct — no exposure to anon/authenticated.
- **Cron schedule manual step:** Operator must run `cron.schedule` after migration; easy to forget. Doc is clear; matches menu-import pattern.
- **Local migration untested:** Docker not running during implementation; Tester should validate in Stage 2.

## Acceptance Criteria

- [x] Happy path: function deletes only `entregue` orders from previous calendar day in `America/Sao_Paulo`.
- [x] Unhappy path: single transactional DELETE; documented setup/rollback.
- [x] Edge cases: half-open interval, explicit timezone, empty result returns 0.
- [x] SECURITY DEFINER for DELETE privilege; no grants to anon/authenticated.
- [x] Docs cover setup, disable, re-enable, rollback.
- [x] No out-of-scope changes; no HTTP-exposed RPC.
- [x] Brief success criteria addressed (job trigger, cutoff, idempotent, customers unaffected, operator can disable).
