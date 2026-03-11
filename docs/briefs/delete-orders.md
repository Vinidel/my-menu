# Feature Brief — Recurring Deletion of Delivered Orders

Status: Stage 0 — Complete (Critic approved)
Date: 2026-03-11
Author: Orchestrator Agent
Workflow: Full

---

## Workflow Routing Decision

Change type: feature
Workflow selected: Full
Reason:
- Scope: New scheduled job that permanently deletes database rows; touches data lifecycle and operational configuration.
- Risk: Moderate — incorrect cutoff logic or timezone handling could delete wrong orders; deletion is irreversible.
- Blast radius: `orders` table; admin dashboard (fewer historical orders visible); no customer-facing change.
- Urgency: Normal.
- Required stages:
  - Orchestrator
  - Implementer
  - Tester
  - Hardener
  - Documenter
- Skipped stages and why: None.

---

## Alternative Name

Scheduled cleanup of delivered orders / Purge `entregue` orders daily

---

## Problem

Orders that have reached status `entregue` accumulate indefinitely. The burger place does not need to retain delivered orders indefinitely — they clutter the admin list and grow the database without providing ongoing value.

---

## Goal

Add a recurring job that runs **once per day** and deletes orders with status `entregue` from the **previous calendar day** only.

Success = the job runs daily, deletes only the intended rows (status `entregue` + within the defined cutoff window), does not delete orders from other statuses or other time periods, and leaves `customers` rows intact (no cascade from `orders` to `customers` — the FK is `orders.customer_id → customers.id`).

---

## Who

- **Burger owner / employees:** See fewer historical delivered orders in `/admin`; active and recent orders remain.
- **Operators / developers:** Need predictable, auditable deletion behavior and safe rollback if misconfigured.
- **Data:** `orders` rows are permanently removed; `customers` remain (no cascade from orders to customers; deleting orders removes only order rows).

---

## What We Capture / Change

- **Scheduler:** A daily cron job (or equivalent) triggers the deletion logic.
- **Deletion rule:** Delete from `public.orders` where:
  - `status = 'entregue'`
  - `updated_at` falls within the **previous calendar day** in `America/Sao_Paulo` (Brazil).
- **No schema changes to `orders`:** Existing columns suffice; `updated_at` is used as the cutoff timestamp (when the order was last updated, typically when it was marked `entregue`).
- **No changes to `customers`:** Deletion of orders does not delete customers; no cascade from `orders` to `customers` — the FK is `orders.customer_id → customers.id`, so deleting orders removes only order rows.

---

## Success Criteria

- [ ] A scheduled job runs once per day.
- [ ] The job deletes only orders with `status = 'entregue'`.
- [ ] The job deletes only orders whose `updated_at` falls within the previous calendar day in `America/Sao_Paulo`.
- [ ] Orders from other statuses are never deleted.
- [ ] Orders from earlier days (older than previous day) or from today are not deleted by this job.
- [ ] The deletion is idempotent for a given day (running twice in the same day for the same cutoff window yields no extra deletes).
- [ ] Customers table and other tables remain unaffected; order deletion does not cascade to customers.
- [ ] The job can be disabled or reconfigured without code deploy (e.g. via Supabase cron config).

---

## Non-Goals (Out of Scope)

- Manual admin UI to delete individual orders (separate brief; see `todos.md`).
- Deletion of orders in statuses other than `entregue`.
- Archiving orders before deletion (e.g. move to archive table).
- Configurable retention window (e.g. “keep 7 days”) — this feature is fixed to “previous day only.”
- Multi-timezone or configurable timezone — locked to `America/Sao_Paulo`.
- Audit log of deleted orders (deletion is silent; no audit table in this scope).

---

## Acceptance Scenarios

### Happy Paths

1. **Daily run deletes yesterday’s delivered orders.** Job runs; it deletes all orders with `status = 'entregue'` and `updated_at` in the previous calendar day (e.g. if run on March 12 00:05 BRT, deletes orders with `updated_at` in March 11 00:00:00–23:59:59 BRT).
2. **No orders to delete.** Job runs; zero orders match the criteria; no errors, no side effects.
3. **Mix of statuses on same day.** Orders in `aguardando_confirmacao`, `em_preparo`, `pronto_para_retirada`, `saiu_para_entrega` from yesterday are not deleted; only `entregue` from yesterday are deleted.
4. **Customers preserved.** Deleting orders does not remove customer rows; no cascade from orders to customers.

### Unhappy Paths

1. **Job fails mid-run.** Partial delete possible; implementation should use a single transactional delete where feasible.
2. **Scheduler misconfiguration.** Job does not run or runs at wrong time; documented setup and rollback steps should exist.
3. **Timezone drift.** Server or DB timezone differs from `America/Sao_Paulo`; cutoff logic must explicitly use Brazil timezone.

---

## Edge Cases

- **Midnight boundary:** Orders updated at 23:59:59 on day N vs 00:00:00 on day N+1 must be correctly attributed; cutoff uses half-open interval `[start_of_day, end_of_day)` so 23:59:59.999 is included and 00:00:00 of next day is excluded.
- **DST (Daylight Saving Time):** Brazil (São Paulo) may observe DST; `America/Sao_Paulo` handles this; ensure the cutoff uses a timezone-aware function.
- **Empty result:** `DELETE` with no matching rows is safe and idempotent.
- **Legacy orders:** Old `entregue` orders from many days ago are not deleted by this job (only previous day). If broader retention policy is needed later, that is a separate feature.
- **Concurrent admin updates:** An order marked `entregue` at 23:58 and then updated again at 00:02 next day — the job uses `updated_at`; clarify whether we want “day it was marked entregue” (would need a dedicated column) or “day of last update.” **Locked:** we use `updated_at`; for typical flow (progression to entregue is the final update), this is correct.

---

## Approach (High-Level Rationale)

1. **Trigger:** Use Supabase scheduler (pg_cron) already in use for menu-import worker. Add a daily cron schedule (e.g. 00:05 or 01:00 BRT). **Note:** pg_cron runs in UTC; convert BRT to UTC when configuring (e.g. 00:05 BRT = 03:05 UTC).
2. **Execution path (choose one):**
   - **Option A (preferred if simple):** Postgres function `public.delete_entregue_orders_from_previous_day()` that runs the DELETE with explicit `America/Sao_Paulo` cutoff. Cron invokes the function directly. Function needs `SECURITY DEFINER` or equivalent to perform DELETE (authenticated role currently has no DELETE on orders).
   - **Option B:** Edge Function invoked by pg_cron via pg_net (like menu-import worker); function uses service-role Supabase client to delete. Requires new Edge Function and worker secret.
3. **Cutoff logic:** Previous calendar day in `America/Sao_Paulo`:
   - `start_of_previous_day = (current_date at time zone 'America/Sao_Paulo' - interval '1 day')::date at time zone 'America/Sao_Paulo'`
   - `end_of_previous_day = start_of_previous_day + interval '1 day'`
   - Delete where `status = 'entregue'` and `updated_at >= start_of_previous_day` and `updated_at < end_of_previous_day` (or equivalent).
4. **Observability:** Log or emit count of deleted rows when possible; at minimum, job should complete without unhandled errors.
5. **Documentation:** Document cron schedule, timezone, and how to disable/re-enable in delivery notes.

---

## Decisions (Locked)

- **Cutoff timestamp:** Use `updated_at`, not `created_at`.
- **Cutoff window:** Previous calendar day only, in `America/Sao_Paulo`.
- **Status filter:** Only `status = 'entregue'`.
- **Cadence:** Once per day.
- **Customers:** Do not delete; no cascade from orders to customers.
- **Execution:** Prefer Postgres function + pg_cron if feasible; Edge Function is acceptable if DB function is constrained.

---

## Security / Operational Constraints

- Deletion must run with privileges that allow DELETE on `orders`; current authenticated role does not. Use SECURITY DEFINER function or service-role client.
- Cron job must not be callable by unauthenticated or arbitrary users; pg_cron runs in DB context; Edge Function path must validate worker secret if used.
- Deletion is irreversible; no soft-delete or recycle bin in this scope.
- Operator must be able to disable the cron schedule without redeploying code.

---

## Stage 0 Exit Gate

- [x] Workflow routing decision is explicit and justified
- [x] Problem is clearly defined
- [x] Goals are concrete and testable
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] Major security and operational constraints are surfaced when relevant
- [x] Approach is outlined at a high level (no code)
- [x] Critic has approved this brief
