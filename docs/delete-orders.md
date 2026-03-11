# Recurring Deletion of Delivered Orders — Feature Documentation

Summary for the next engineer: what was built, where it lives, and how to operate it.

**Brief:** [docs/briefs/delete-orders.md](briefs/delete-orders.md)

**Request source:** [docs/requests/delete-orders.md](requests/delete-orders.md)

---

## What Was Delivered

- **Postgres function:** `public.delete_entregue_orders_from_previous_day()` — SECURITY DEFINER, deletes orders with `status = 'entregue'` and `updated_at` in the previous calendar day (`America/Sao_Paulo`). Returns count of deleted rows. Single transactional `DELETE`. Cutoff uses `(now() at time zone 'America/Sao_Paulo')::date` so the previous-day window is independent of session/connection timezone. Emits `RAISE NOTICE` with deleted count for postgres/Supabase logs.
- **Cron schedule:** Configure manually via Supabase SQL editor (see Setup below). Default: daily at 03:05 UTC (00:05 BRT).

---

## Where It Lives

| Area | Path |
|------|------|
| Migration (function) | `supabase/migrations/20260311000000_add_delete_entregue_orders_function.sql` |
| Cron setup (manual) | See Setup below |

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
- **Cron verification:** No automated check that pg_cron is configured after migration; manual setup step in docs. See hardening-notes for full sweep.
- **Retry logic:** If the function throws, pg_cron logs the error; no retry. Acceptable for daily cadence — orders accumulate until next run.

---

## Setup

### 1) Run migration

Apply the migration so the function exists:

```bash
supabase db push
```

Or apply via Supabase Dashboard → SQL Editor if using hosted Supabase.

### 2) Enable pg_cron (if not already enabled)

In Supabase Dashboard → Database → Extensions, enable `pg_cron`. (Already enabled if menu-import worker is in use.)

### 3) Schedule the cron job

Run in Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'delete-entregue-orders-daily',
  '5 3 * * *',
  'SELECT public.delete_entregue_orders_from_previous_day()'
);
```

- Schedule: `5 3 * * *` = 03:05 UTC daily (= 00:05 BRT, Brazil).
- To use 01:00 BRT instead: `0 4 * * *` (04:00 UTC).

---

## Disable / Re-enable / Rollback

- **Disable:** `SELECT cron.unschedule('delete-entregue-orders-daily');`
- **Re-enable:** Re-run the `cron.schedule` above.
- **Rollback:** Disable the cron job. No data recovery possible (deletion is irreversible).

---

## Operational Notes

- **Deletion count in logs:** The function emits `RAISE NOTICE 'delete_entregue_orders_from_previous_day: N rows deleted'`. Check Supabase logs (or postgres logs) after pg_cron runs to verify expected volume.
- **Rollback:** Disabling the cron removes future deletes but does not recover already-deleted rows. Deletion is irreversible.

## For the Next Engineer

- Read `docs/briefs/delete-orders.md` before implementing — it contains the full acceptance scenarios and edge cases.
- Read `docs/hardening-notes.md` (Recurring Deletion of Delivered Orders section) for security, dependencies, performance, observability, and resilience.
- Cutoff logic must explicitly use `America/Sao_Paulo`; do not rely on `current_date` or session/connection timezone.
- If adding a Postgres function, use `(now() at time zone 'America/Sao_Paulo')::date` for timezone-robust date derivation.
