# Feature Brief — Admin Orders Dashboard Polling (TanStack Query)

Status: Stage 5 — Documentation Complete (pending Critic)
Date: 2026-02-24
Author: Orchestrator Agent

---

## Alternative Name

Polling de pedidos no `/admin` / Atualização automática do dashboard / TanStack Query no painel de pedidos

---

## Problem

The `/admin` employee orders dashboard currently requires manual refresh/navigation to see newly submitted orders or status changes made elsewhere. This creates operational friction during busy periods, especially when customer orders are arriving continuously.

Without automatic refresh, employees may miss new `aguardando_confirmacao` orders or work with stale information, slowing preparation and increasing the chance of duplicate/conflicting actions.

---

## Goal

Add automatic polling to the `/admin` orders dashboard using **TanStack Query** so order data refreshes periodically without a full page reload, while preserving the existing status progression workflow, sorting, and Portuguese UI.

Success = an authenticated employee can keep `/admin` open and see new/updated orders appear automatically within the polling window, with existing mobile accordion and desktop interactions remaining usable.

---

## Who

- **Employees (burger owner / staff):** Primary users. Need fresher order data with less manual refresh.
- **Customers:** Indirectly affected (faster employee awareness of new orders).
- **Developers/operators:** Need a maintainable polling implementation that does not break current auth, `/admin` behavior, or server actions.

---

## What We Capture / Change

- **`/admin` data refresh behavior:**
  - Replace one-time loaded dashboard state (or augment it) with a polling-driven client data layer using TanStack Query
  - Poll for the latest orders list on a fixed interval (locked below)
  - Preserve current display behavior:
    - status-first sorting
    - mobile accordion single-expand (`<768px`)
    - summary counts
    - details rendering (including extras)
- **Read API/data fetch path for polling (feature must lock implementation path in Stage 1):**
  - Polling requires a callable read endpoint or fetcher strategy appropriate for authenticated `/admin` users
  - Must preserve auth protection (no public exposure of employee order data)
- **Status progression interaction compatibility:**
  - Existing forward-only progression + stale handling must continue to work while polling is active
  - UI should remain understandable if polled data updates while an order is selected/expanded
- **Loading and error UX during polling:**
  - Initial load and subsequent refresh failures must remain in Portuguese
  - Background polling failures should not crash or blank the dashboard

---

## Success Criteria

- [ ] `/admin` automatically refreshes orders data on a fixed polling interval without requiring a full page reload.
- [ ] Polling uses TanStack Query (locked library for this feature).
- [ ] Existing auth protection for `/admin` order data remains intact (no new public read exposure).
- [ ] Existing status-first sorting, summary counts, and order detail rendering remain correct after polling updates.
- [ ] Existing mobile accordion behavior (`< 768px`, single-expand) remains usable with polled updates.
- [ ] Existing status progression flow still works while polling is active (including stale/concurrent handling).
- [ ] Polling does not overwrite the local pending UI state for an order with an in-flight status progression request before that mutation settles (locked conflict rule below).
- [ ] Background polling errors are handled gracefully in pt-BR (no UI crash; existing data can remain visible).
- [ ] Polling does not refetch when the `/admin` tab is hidden (locked below) to reduce unnecessary load.
- [ ] No schema/RLS/auth model changes are required unless explicitly justified in implementation notes.

---

## Non-Goals (Out of Scope)

- Supabase Realtime subscriptions / websockets.
- Pagination, search, or admin filters.
- Visual redesign of `/admin` beyond minor loading/refresh indicators if needed.
- Changing order status contracts or DB schema.
- Replacing the existing status progression server action with a different workflow.
- Customer-facing realtime order tracking.

---

## Acceptance Scenarios

### Happy Paths

1. **New order appears without manual refresh.** Employee keeps `/admin` open and a newly submitted order appears automatically within the polling interval, with summary counts updated.
2. **Status change appears after polling refresh.** If an order status changes (by another tab/session), the dashboard reflects the new status and reorders it correctly by the existing status-first sort.
3. **Employee progresses order while polling is enabled.** Employee updates an order status and the UI remains consistent before/after the next poll; polling does not overwrite the pending local state for that same order before the mutation settles.
4. **Hidden tab pauses polling.** Employee switches browser tabs/windows; polling pauses while `/admin` is not visible and resumes when visible again, triggering one immediate refetch on visibility restore.
5. **Mobile accordion remains usable.** On mobile viewport, employee can expand an order inline and continue interacting even as periodic polling runs.

### Unhappy Paths

1. **Polling request fails temporarily.** Dashboard keeps the last successful data visible, shows a non-disruptive pt-BR error/feedback state (or existing error treatment for background failures), and resumes polling later.
2. **Auth expires while dashboard is open.** Polling fetch fails in an auth-related way; behavior should fail safely (e.g. show error and/or redirect via existing auth/middleware flow on navigation) without exposing data.
3. **Empty orders response.** Dashboard still renders the existing empty-state UX correctly on initial load or after a refresh.

---

## Edge Cases

- **Polling overlaps with in-flight status update:** A poll may return old/new data while the employee is progressing an order. UI should avoid obvious breakage and preserve deterministic status handling.
- **Selected/expanded order disappears or moves:** Polled data may reorder items (status-first sort) or remove an order from current list (unexpected/manual cleanup). Selection/accordion state should degrade safely.
- **Background error after successful initial load:** UI should not regress to a full-page fatal state if only a poll cycle fails.
- **Low-volume periods:** Polling should not create excessive noise/load when no orders are changing.
- **Multiple admin tabs:** Each tab may poll independently; this is acceptable in this feature unless explicitly optimized later.

---

## Approach (High-Level Rationale)

1. **Use TanStack Query for polling state.** Centralize async fetch state (loading, error, stale data, refetch interval) rather than building custom timers/state logic in the dashboard component.
2. **Preserve server-rendered initial data when practical.** Start the dashboard with current server-loaded orders and hydrate TanStack Query from that data to avoid regressions in initial page load UX.
3. **Authenticated read path only.** Polling fetcher must use an authenticated route/fetch path or server-mediated endpoint that does not expose orders publicly.
4. **Keep current dashboard behavior stable.** Polling should update data, not redefine sorting, status progression, mobile accordion, or brief-locked employee UX behavior.
5. **Pause when hidden.** Avoid polling while the tab is not visible to reduce unnecessary requests and load.

---

## Decisions (Locked)

- **Feature scope:** Add polling-based auto-refresh to the existing `/admin` employee orders dashboard.
- **Library (locked):** Use **TanStack Query** for polling/query state.
- **Polling interval (locked):** `10 seconds` while the `/admin` page is visible.
- **Visibility behavior (locked):** Polling pauses when the document/tab is hidden and resumes when visible.
- **Visibility restore refetch behavior (locked):** When the tab becomes visible again, trigger one immediate refetch, then continue the normal `10 seconds` polling cadence.
- **Initial data strategy (locked):** Reuse the existing server-loaded `/admin` orders data as the initial query data (hydration/seeded cache approach) when implementing polling.
- **Sorting/UX parity (locked):** Existing status-first sorting, mobile accordion behavior, and summary counts remain unchanged.
- **Status progression behavior (locked):** Keep existing forward-only progression and stale update handling.
- **Polling vs in-flight status mutation conflict rule (locked):**
  - If an order status progression request is pending for a specific order, polling refreshes must not replace that order’s local pending UI state until the mutation settles (success or error).
  - Polling may continue updating other orders while that mutation is pending.
  - After the mutation settles, normal reconciliation with the next successful poll (or mutation success handling) may proceed.
- **Auth protection (locked):** Polling must not introduce public read access to orders; authenticated admin access only.
- **Error UX (locked):**
  - Initial load failure can keep current `/admin` error-state behavior
  - Background polling failures should be non-destructive (keep last good data visible)
- **No realtime subscriptions (locked):** Polling only in this feature; Supabase Realtime is a future option.
- **Language:** Employee-facing messages/labels remain Portuguese (pt-BR).

---

## Open Implementation Choice (To Resolve in Stage 1)

Stage 1 must choose and document one authenticated polling read path:

- **Option A:** Add a protected route handler (e.g. `GET /api/admin/orders`) that returns parsed orders for the dashboard; middleware/auth checks protect access.
- **Option B:** Add a server-action-compatible fetch wrapper or client Supabase query path for authenticated users (only if auth and type safety remain clear).

Preferred bias for this project: **Option A** (explicit route contract, easier TanStack Query fetcher and route-level tests), unless the current app architecture makes another path significantly simpler without weakening auth.

If **Option A** is chosen, preferred response shape is the parsed dashboard order payload (same shape consumed by `AdminOrdersDashboard`) to avoid duplicating order parsing logic in the browser.

---

## Stage 0 Exit Gate

- [x] Problem is clearly defined
- [x] Goals are concrete and testable
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] Approach is outlined at a high level (no code)
- [ ] Critic has approved this brief
