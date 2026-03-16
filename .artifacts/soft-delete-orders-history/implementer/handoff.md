# Stage Handoff

Feature: soft-delete-orders-history
Stage: implementer
Workflow: full

---

## Files Changed
- `supabase/migrations/20260316090000_soft_delete_delivered_orders_for_history.sql`
- `lib/supabase/admin-orders-data-access.ts`
- `app/admin/actions.ts`
- `lib/supabase/database.types.ts`
- `.artifacts/soft-delete-orders-history/implementer/handoff.md`

---

## What Changed
- Added explicit soft-delete metadata to `orders` via a new migration: `is_deleted` plus `soft_deleted_at`.
- Replaced the old delivered-order cleanup behavior so `public.delete_entregue_orders_from_previous_day()` now soft-deletes eligible delivered rows instead of hard-deleting them, updating both soft-delete fields together.
- Kept the existing cron entrypoint name so already-configured schedules continue invoking the updated retention behavior after the migration.
- Locked operational reads behind the admin/orders data-access boundary by filtering `is_deleted = false` for list and status snapshot lookups.
- Locked operational mutation behavior by filtering conditional status updates to active rows only and treating missing/non-operational rows as invalid for progression.

---

## Known Gaps
- `docs/delete-orders.md` still documents the superseded hard-delete behavior; Stage 4/5 docs need to replace that narrative with the new soft-delete policy.
- I did not run Supabase-backed migration verification in this stage, so the new function and active-row filtering still need Stage 2 validation.
- Existing rows already hard-deleted by the previous feature remain unrecoverable.

---

## Evidence
- Soft-delete migration/function: `supabase/migrations/20260316090000_soft_delete_delivered_orders_for_history.sql`
- Active-order read filtering: `lib/supabase/admin-orders-data-access.ts`
- Non-operational mutation guard: `app/admin/actions.ts`
- Generated DB type alignment: `lib/supabase/database.types.ts`
- Soft-delete metadata consistency is enforced in the migration with an `is_deleted` / `soft_deleted_at` check constraint.
- Scope stayed within the brief: no history UI, restore flow, or reporting work was added.

---

## Next Review Focus
- Verify the migration soft-deletes `entregue` rows older than the current Brazil calendar day and catches up older eligible rows.
- Verify `/admin` list, polling, and status progression no longer surface or mutate rows where `is_deleted = true`.
- Review whether keeping the legacy cron function name is acceptable operationally or should be renamed in a later documentation pass.
