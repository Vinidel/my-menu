# Soft Delete Delivered Orders for History — Feature Documentation

Summary for the next engineer: what changed, where it lives, what remains deferred, and how to operate the retention job safely.

**Brief:** [docs/briefs/soft-delete-orders-history.md](briefs/soft-delete-orders-history.md)

---

## What Was Delivered

- **Retention model changed:** Delivered orders are no longer hard-deleted from `public.orders`; they are retained as history via soft-delete metadata.
- **Explicit deletion metadata:** `public.orders` now uses `is_deleted` plus `soft_deleted_at` to distinguish active operational rows from retained historical rows.
- **Daily cleanup behavior changed:** The existing scheduled cleanup entrypoint still runs daily, but it now soft-deletes eligible delivered rows instead of removing them.
- **Catch-up behavior is locked:** If the scheduler misses one or more days, the next successful run soft-deletes all still-active delivered rows older than the current Brazil calendar day.
- **Operational reads stay clean:** Admin operational list/detail/count/polling paths exclude soft-deleted rows by default.
- **Operational mutations are guarded:** Standard admin/server status progression treats soft-deleted rows as non-operational and refuses to mutate them.

---

## Where It Lives

| Area | Path |
|------|------|
| Schema + cleanup function | `supabase/migrations/20260316090000_soft_delete_delivered_orders_for_history.sql` |
| Admin operational read filter | `lib/supabase/admin-orders-data-access.ts` |
| Admin operational mutation guard | `app/admin/actions.ts` |
| Targeted regression tests | `lib/supabase/admin-orders-data-access.test.ts`, `app/admin/actions.test.ts` |
| Stage artifacts | `.artifacts/soft-delete-orders-history/` |

---

## Decisions (Locked)

| Decision | Rationale |
|----------|-----------|
| Keep rows in `public.orders` | Historical retention is now required for future reporting/history work. |
| Use both `is_deleted` and `soft_deleted_at` | `is_deleted` keeps operational filtering explicit; `soft_deleted_at` preserves deletion timing. |
| Keep `updated_at` as eligibility timestamp | Reuses the existing retention contract and avoids introducing another lifecycle column in this feature. |
| Keep the cleanup entrypoint name `delete_entregue_orders_from_previous_day()` | Preserves scheduler compatibility during rollout even though the function now soft-deletes. |
| Filter operational reads on `is_deleted = false` | Makes the active-row contract explicit and easy to audit across app paths. |
| Treat soft-deleted rows as non-operational | Hidden historical rows must not remain mutable through stale tabs or direct operational requests. |
| Use `America/Sao_Paulo` day boundaries | The app operates in Brazil; retention semantics stay tied to Brazil calendar days. |

---

## Operational Contract

- **Active row:** `is_deleted = false` and `soft_deleted_at is null`
- **Historical soft-deleted row:** `is_deleted = true` and `soft_deleted_at is not null`
- **Eligibility for cleanup:** `status = 'entregue'`, `is_deleted = false`, and `updated_at` earlier than the start of the current day in `America/Sao_Paulo`
- **Cleanup effect:** set `is_deleted = true` and `soft_deleted_at = now()`
- **Operational app behavior:** active-order surfaces must query only rows where `is_deleted = false`
- **Operational mutation behavior:** stale actions against soft-deleted rows must fail safely rather than mutating retained history

---

## Setup / Rollout Notes

### 1) Apply the migration

Run the migration that adds the soft-delete fields, check constraint, and replacement cleanup function:

```bash
supabase db push
```

### 2) Keep the existing cron entrypoint

The scheduled SQL still calls:

```sql
SELECT public.delete_entregue_orders_from_previous_day();
```

That function name is legacy-compatible. Its behavior is now **soft delete**, not hard delete.

### 3) Verify the scheduler safely

Recommended Supabase SQL checks after rollout:

```sql
select id, is_deleted, soft_deleted_at, status, updated_at
from public.orders
where status = 'entregue'
order by updated_at desc;
```

```sql
select public.delete_entregue_orders_from_previous_day();
```

Expected result:
- eligible old delivered rows remain in `public.orders`
- those rows become `is_deleted = true`
- those rows get a non-null `soft_deleted_at`
- active rows stay unchanged

---

## Known Gaps & Deferred Work

- **No history UI yet:** Historical rows are retained in the database, but there is still no admin/customer history view in this feature.
- **No restore flow:** There is no undelete or operator restore tooling.
- **No real DB verification in this workflow run:** The migration/function was not exercised against a live Supabase/Postgres environment during Stage 2/3; the remaining verification gap is known and documented.
- **Legacy naming remains:** The function name still says `delete_*` even though it soft-deletes now; this is intentional for compatibility but easy to misread.
- **No later purge policy:** Soft-deleted rows are retained indefinitely until a future feature defines long-term archival or purge behavior.

---

## Rollback / Recovery

- **Application rollback:** Revert the app code and migration together; do not leave app code expecting `is_deleted` while the schema lacks it.
- **Cron rollback:** If the cleanup must be paused, unschedule the cron job rather than reintroducing hard-delete behavior.
- **Data recovery:** Soft deletion is reversible in principle by direct SQL because rows remain stored, but this feature does not provide supported restore tooling.

---

## For the Next Engineer

- Read `docs/delete-orders.md` before touching the cron or function name; it now documents the legacy-compatible cleanup entrypoint and the policy change from hard delete to soft delete.
- Do not add a history screen by querying `public.orders` directly without making the active-vs-history filter explicit.
- If future work introduces restore, exports, or reporting, treat `is_deleted` and `soft_deleted_at` as a paired contract, not independent hints.
- If the legacy function name becomes too confusing operationally, rename it in a dedicated migration and update the scheduler atomically.
