# Critique

Date: 2026-03-11
Reviewed by: Critic Agent
Scope: docs/briefs/delete-orders.md (Stage 0 — Orchestrator)
Verdict: APPROVE

## Findings

### Required Changes

None.

### Suggested Improvements

- **What We Capture / Change (line 64) — FK direction clarity:** The sentence "Deletion of orders does not delete customers; `customer_id` is set to null on order delete via FK" is backwards. The FK `on delete set null` applies when a *customer* is deleted (then the order's `customer_id` is set to null). When *orders* are deleted, customer rows are simply unaffected. Consider: "Deletion of orders does not delete customers; no cascade from `orders` to `customers` — the FK is `orders.customer_id → customers.id`, so deleting orders removes only order rows."
- **Approach (line 122) — Cron timezone:** pg_cron typically runs in UTC. If the desired run time is "00:05 BRT", the implementer must schedule `03:05 UTC` (BRT = UTC-3). Brief could add a note: "Cron schedule uses UTC; convert BRT to UTC when configuring."
- **Edge Cases (line 111) — Midnight boundary wording:** "inclusive start and end" could imply `[start, end]` inclusive of both bounds. The Approach correctly uses `>= start` and `< end` (half-open interval). Consider clarifying: " cutoff uses half-open interval [start_of_day, end_of_day) so 23:59:59.999 is included and 00:00:00 of next day is excluded."

### Risks / Assumptions

- **Legacy orders never purged:** Old `entregue` orders from weeks/months ago remain. The brief correctly calls this out as a Non-Goal; operator should be aware if historical clutter is a future concern.
- **pg_cron availability:** Brief assumes pg_cron is already enabled (menu-import uses it). If the Supabase project lacks pg_cron, the implementer must enable it — documented in menu-import delivery notes.
- **SECURITY DEFINER scope:** A Postgres function with SECURITY DEFINER runs with definer's privileges. The brief notes this is needed for DELETE; implementer must ensure the function is not callable by non-cron contexts (pg_cron invokes it directly; no HTTP-exposed RPC in scope).

## Acceptance Criteria

- [x] Brief aligns with PROJECT.md (Brazil app, Supabase, small scale).
- [x] Workflow depth (Full) appropriate for irreversible data deletion.
- [x] Happy paths, unhappy paths, and edge cases documented.
- [x] Non-goals clearly fence scope (no manual UI, no archiving).
- [x] Cutoff logic and timezone explicitly defined.
- [x] Security/operational constraints surfaced.
- [x] Handoff references correct files and next-stage focus.
