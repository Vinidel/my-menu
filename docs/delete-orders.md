# Delivered Orders Cleanup Entry Point — Legacy Name, New Behavior

This document exists because the scheduled cleanup function name was kept for compatibility:

```sql
public.delete_entregue_orders_from_previous_day()
```

That name is now legacy. The function no longer hard-deletes rows.

**Current feature doc:** [docs/soft-delete-orders-history.md](soft-delete-orders-history.md)  
**Superseded brief:** [docs/briefs/delete-orders.md](briefs/delete-orders.md)  
**Replacement brief:** [docs/briefs/soft-delete-orders-history.md](briefs/soft-delete-orders-history.md)

---

## Current Behavior

- The scheduled cleanup still targets delivered orders using `updated_at` and `America/Sao_Paulo` day boundaries.
- The function now **soft-deletes** eligible rows by setting:
  - `is_deleted = true`
  - `soft_deleted_at = now()`
- Matching rows remain in `public.orders` for future history/reporting work.
- Operational app reads are expected to ignore those rows by filtering on `is_deleted = false`.

---

## Why This File Still Exists

- Operators may still recognize the old cron/function name.
- The scheduler can keep calling the same SQL entrypoint during rollout.
- Future engineers need one obvious place explaining that `delete_*` is now a soft-delete compatibility alias, not a hard-delete policy.

---

## What Changed

| Before | Now |
|--------|-----|
| Delivered rows were physically removed | Delivered rows are retained as soft-deleted history |
| No recovery path once deleted | Rows remain queryable in `public.orders` |
| Previous-day-only delete behavior | Catch-up soft-deletes any still-active eligible delivered rows older than the current Brazil day |
| Hard-delete operator guidance | Soft-delete history retention guidance |

---

## Operational Reminder

If you are validating the cron or function in Supabase SQL, expect retained rows with soft-delete metadata rather than missing rows.

```sql
select id, status, is_deleted, soft_deleted_at, updated_at
from public.orders
where status = 'entregue'
order by updated_at desc;
```

For the full current contract, use `docs/soft-delete-orders-history.md`.
