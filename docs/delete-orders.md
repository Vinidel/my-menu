# Recurring Deletion of Delivered Orders — Scoping (Stage 0)

Summary for the next engineer: what was scoped, what was decided, and what to watch for during implementation.

**Brief:** [docs/briefs/delete-orders.md](briefs/delete-orders.md)

**Request source:** [docs/requests/delete-orders.md](requests/delete-orders.md)

---

## What Was Scoped (Stage 0)

- **Recurring job:** Runs once per day, deletes orders with `status = 'entregue'` from the **previous calendar day** only.
- **Cutoff:** `updated_at` in `America/Sao_Paulo` (Brazil). Half-open interval `[start_of_day, end_of_day)` — 23:59:59.999 included, 00:00:00 next day excluded.
- **Customers:** Order deletion does not cascade to customers; no schema changes.
- **Execution:** Prefer Postgres function + pg_cron; Edge Function acceptable if DB path is constrained.

---

## Decisions (Locked)

| Decision | Rationale |
|----------|------------|
| Cutoff timestamp = `updated_at` | When order was last updated (typically when marked entregue); no dedicated column. |
| Cutoff window = previous calendar day only | Fixed retention; no configurable “keep N days” in scope. |
| Timezone = `America/Sao_Paulo` | App serves Brazil; lock to São Paulo time. |
| Status filter = `entregue` only | Other statuses never deleted. |
| pg_cron runs in UTC | Cron config uses UTC; convert BRT when scheduling (e.g. 00:05 BRT = 03:05 UTC). |

---

## What the Implementer Needs to Know

1. **DELETE privilege:** Authenticated role has no DELETE on `orders`. Use SECURITY DEFINER Postgres function or service-role Supabase client.
2. **pg_cron:** Already in use for menu-import worker; reuse existing Supabase scheduler setup. See `docs/menu-generation-from-owner-image.md` for cron config patterns.
3. **SECURITY DEFINER scope:** Function must not be callable by arbitrary users; pg_cron invokes it directly. No HTTP-exposed RPC.
4. **Transactional delete:** Use a single `DELETE`; avoid partial deletes if the job fails mid-run.

---

## Known Gaps & Deferred Work

- **Exact cron schedule:** 00:05 vs 01:00 BRT left to implementer; convert to UTC when configuring.
- **Legacy orders:** Old `entregue` orders from weeks/months ago are not deleted by this job. Broader retention policy would require a separate feature.
- **Audit log:** Deletion is silent; no audit table in scope.

---

## Operational Notes (Post-Implementation)

- **Disable/re-enable:** Operator must be able to disable the cron schedule without redeploying code (Supabase cron config).
- **Rollback:** Disable the cron job; no data recovery possible (deletion is irreversible).
- **Dependencies:** pg_cron, pg_net (if Edge Function path); see menu-import delivery notes for Supabase extension setup.

---

## For the Next Engineer

- Read `docs/briefs/delete-orders.md` before implementing — it contains the full acceptance scenarios and edge cases.
- The Critic flagged: ensure cutoff logic explicitly uses `America/Sao_Paulo`; do not rely on server/DB default timezone.
- If choosing the Postgres function path, add a migration for the function and a separate migration or SQL block for the cron schedule (or document the manual cron setup steps).
