# Feature Brief — Soft Delete Delivered Orders for History

Status: Stage 0 — Brief Complete (pending Critic)
Date: 2026-03-16
Author: Orchestrator Agent
Workflow: Full

---

## Workflow Routing Decision

Change type: feature
Workflow selected: Full
Reason:
- Scope: Replace hard deletion with soft deletion, add retention metadata to `orders`, update recurring cleanup behavior, and make all operational order reads exclude soft-deleted rows.
- Risk: Moderate to high — touches data lifecycle, schema, scheduler behavior, admin visibility, and historical retention semantics.
- Blast radius: `public.orders`, scheduled cleanup job, admin dashboard list/counts/details/polling, and any app-side order read path that should remain operational-only.
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

Order history retention via soft delete / Soft-delete delivered orders instead of purging them

---

## Problem

The current delivered-order cleanup feature permanently deletes `entregue` orders from the previous calendar day. That removes operational clutter from `/admin`, but it also destroys historical records that could be useful later for reporting, audits, support, or future history views.

The product need has changed: delivered orders should no longer be hard-deleted. They should be retained as historical records while disappearing from the active operational surfaces used by employees day to day.

---

## Goal

Replace the current hard-delete retention behavior with soft deletion.

Success = the daily cleanup job marks old delivered orders as soft deleted instead of removing rows, all operational order views stop showing soft-deleted orders, and the retained rows remain available in the database for future history-oriented work.

---

## Who

- **Burger owner / employees:** Continue seeing only active operational orders in `/admin`, without historical delivered rows cluttering the dashboard.
- **Operators / developers:** Keep historical order rows in the database for future reporting/history use while preserving predictable daily cleanup behavior.
- **Data / future product work:** Historical delivered orders remain queryable instead of being irreversibly lost.

---

## What We Capture / Change

- **`orders` retention state:** Add soft-delete metadata to `public.orders` so a row can be retained but excluded from operational reads.
- **Daily cleanup behavior:** The recurring cleanup job still runs once per day, but it updates matching rows into a soft-deleted state instead of physically deleting them.
- **Catch-up retention behavior:** If the scheduler misses one or more days, the next successful run must soft-delete all still-active eligible `entregue` rows older than the current Brazil calendar day, not only the immediately previous day.
- **Operational read filtering:** `/admin` list/detail/count/polling and any app-layer operational order fetches must exclude soft-deleted rows by default.
- **Operational mutation behavior:** Soft-deleted orders are treated as non-operational rows; admin/server operational actions must not progress or mutate them through normal active-order flows.
- **Historical retention:** Soft-deleted rows remain in `public.orders` for future history/reporting features.
- **Superseded prior behavior:** This feature replaces the hard-delete policy documented in `docs/briefs/delete-orders.md` and `docs/delete-orders.md`.

---

## Success Criteria

- [ ] `public.orders` supports a soft-deleted state without removing rows from the table.
- [ ] The daily cleanup job marks eligible delivered orders older than the current `America/Sao_Paulo` calendar day as soft deleted, including catch-up rows from missed prior runs.
- [ ] The daily cleanup job does not hard-delete any orders.
- [ ] `/admin` operational views exclude soft-deleted orders by default.
- [ ] Operational summary counts exclude soft-deleted orders by default.
- [ ] Admin/server operational actions treat soft-deleted orders as non-operational and do not mutate them through normal active-order flows.
- [ ] Active orders and non-soft-deleted delivered orders outside the cleanup window continue behaving normally.
- [ ] The cleanup remains idempotent for a given day/window (running twice does not keep mutating already-soft-deleted rows in a harmful way).
- [ ] Historical soft-deleted rows remain queryable in the database for future features.
- [ ] The new retention behavior is documented clearly enough that future engineers do not reuse old hard-delete assumptions.

---

## Non-Goals (Out of Scope)

- Building a customer-facing or admin-facing order history UI in this feature.
- Adding restore/undelete tooling for soft-deleted orders.
- Adding reporting, analytics, exports, or audit logs on top of the retained history.
- Changing the cleanup cadence or retention window beyond “previous calendar day.”
- Building catch-up tooling beyond the locked automatic “soft-delete all still-eligible old delivered rows on the next successful run” behavior.
- Soft-deleting orders in statuses other than `entregue`.
- Physically purging soft-deleted rows after some later retention period.

---

## Acceptance Scenarios

### Happy Paths

1. **Daily run soft deletes yesterday’s delivered orders.** The scheduler runs and marks all orders with `status = 'entregue'` and `updated_at` in the previous calendar day (`America/Sao_Paulo`) as soft deleted.
2. **No matching orders.** The scheduler runs, finds no matching delivered rows for the window, and exits cleanly with no side effects.
3. **Operational dashboard stays clean.** Employees open `/admin` and do not see soft-deleted rows in list views, detail selections, polling results, or summary counts.
4. **Historical rows remain stored.** After cleanup, matching rows still exist in `public.orders` with soft-delete metadata instead of being removed.
5. **Missed-run catch-up.** If the job did not run for one or more prior days, the next successful run soft-deletes all still-active eligible `entregue` rows older than the current Brazil calendar day so historical delivered rows do not accumulate indefinitely.

### Unhappy Paths

1. **Scheduler runs twice.** A repeated run for the same day does not produce duplicate logical deletion effects or re-hide already-hidden rows in a harmful way.
2. **Filtering regression.** If one operational read path forgets to exclude soft-deleted rows, historical rows can leak back into `/admin`; this feature must explicitly lock default filtering behavior.
3. **Timezone drift.** Cleanup logic must still target the previous Brazil calendar day regardless of session/database timezone.
4. **Legacy hard-delete assumptions remain in docs/code.** This feature must replace the old assumption that delivered-order cleanup physically removes rows.
5. **Stale admin tab or direct request.** An operational action aimed at a soft-deleted order must fail safely instead of mutating a hidden historical row.

---

## Edge Cases

- **Midnight boundary:** Soft-delete window uses a half-open interval `[start_of_previous_day, end_of_previous_day)` in `America/Sao_Paulo`; 23:59:59.999 belongs to the previous day, 00:00:00 belongs to the next day.
- **Missed scheduler days:** Eligibility is cumulative for still-active delivered rows older than the current Brazil calendar day; a later successful run catches up older rows instead of leaving permanent gaps.
- **Final-update semantics:** The cutoff continues to use `updated_at`, not “timestamp when first became entregue”; if a delivered row is touched later, the cleanup window follows the last update.
- **Legacy rows:** Existing historical rows deleted by the old hard-delete job cannot be recovered by this feature; only rows that still exist can be retained going forward.
- **Manual querying:** Future direct SQL queries against `public.orders` can still see soft-deleted rows unless they explicitly filter them out; only app operational paths are locked in this feature.
- **Operational stale references:** A client holding an old order id after cleanup must not be able to keep progressing that soft-deleted order through standard admin/server actions.

---

## Approach (High-Level Rationale)

1. **Retain rows instead of deleting them.** Introduce explicit soft-delete state on `public.orders` rather than relying on absence of rows.
2. **Keep the existing cleanup trigger model.** Reuse the scheduled daily cleanup pattern already established for delivered-order retention logic.
3. **Move operational filtering into the canonical order read paths.** All app/admin code paths that fetch operational orders should exclude soft-deleted rows by default so the dashboard remains focused on active work.
4. **Preserve timezone semantics while allowing catch-up.** Eligibility continues to be determined in `America/Sao_Paulo`, but missed scheduler runs must catch up all still-eligible historical delivered rows rather than processing only one day forever.
5. **Document the policy change explicitly.** Existing hard-delete docs and assumptions must be updated so future work builds on retained history, not irreversible deletion.

---

## Decisions (Locked)

- **Retention mechanism:** Soft delete, not hard delete.
- **Cutoff timestamp:** Continue using `updated_at`.
- **Eligibility window:** Any still-active `entregue` row with `updated_at` earlier than the start of the current calendar day in `America/Sao_Paulo` is eligible for soft deletion; this includes catch-up rows from missed prior runs.
- **Status filter:** Only `status = 'entregue'`.
- **Operational visibility policy:** Soft-deleted orders are excluded from `/admin` and other operational reads by default.
- **Operational mutation policy:** Soft-deleted orders are treated as non-operational and must not be updated through standard admin/server order actions.
- **Historical availability:** Soft-deleted orders remain stored in `public.orders` for future history/reporting features.
- **No history UI yet:** Retaining rows is a data-policy change only in this feature; browsing history is a separate feature.
- **Prior feature superseded:** Hard-delete behavior from `delete-orders` is replaced and should not remain active.

---

## Security / Operational Constraints

- The scheduled cleanup must only mutate the intended delivered rows in the intended time window; accidental broader updates would hide live operational orders.
- The scheduler path must remain non-public; no arbitrary user should be able to trigger bulk soft deletion.
- Operational queries must have one clear default for soft-delete filtering; inconsistent filtering across list/detail/count/polling would create confusing admin behavior.
- Operational mutation paths must defend against stale references to soft-deleted rows; hidden history must not remain writable through normal admin actions.
- Migration/rollout order matters: schema support for soft delete must exist before app code or cron changes depend on it.
- Existing hard-delete job/function must be retired or replaced safely so both mechanisms do not run in parallel.

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
- [ ] Critic has approved this brief
