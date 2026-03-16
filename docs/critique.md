# Critique

Date: 2026-03-16
Reviewed by: Critic Agent
Scope: Stage 1 implementation for `soft-delete-orders-history`
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Stage 2 should add explicit regression coverage for `is_deleted`-based active filtering, metadata consistency expectations, and the non-operational mutation rejection path.

### Risks / Assumptions
- `docs/delete-orders.md` still documents the superseded hard-delete behavior and should be corrected in later stages before final PR packaging.
- This approval assumes `supabase/migrations/20260316090000_soft_delete_delivered_orders_for_history.sql` is applied before relying on the new active-row filtering and cron behavior.
- The legacy cron function name is intentionally preserved for compatibility; later documentation should make the semantic change explicit so operators do not infer hard deletion from the old name.

## Acceptance Criteria
- [x] Soft-deleted rows are explicitly represented with `is_deleted = true` and a non-null `soft_deleted_at`.
- [x] Active rows remain `is_deleted = false` and `soft_deleted_at = null` through the migration constraint.
- [x] Delivered-order cleanup now soft-deletes eligible old rows instead of hard-deleting them.
- [x] The cleanup function catches up older eligible delivered rows, not just the immediately previous day.
- [x] Operational admin order reads exclude rows where `is_deleted = true` through the shared admin/orders data-access boundary.
- [x] Operational status progression no longer mutates soft-deleted or otherwise non-operational rows through the normal admin flow.
- [x] Stage 1 stays within scope and does not add history UI, restore flow, or unrelated refactors.
