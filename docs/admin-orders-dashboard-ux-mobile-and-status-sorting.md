# Admin Orders Dashboard UX (Mobile Accordion + Status-First Sorting) — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and how to operate it.

**Brief:** [docs/briefs/admin-orders-dashboard-ux-mobile-and-status-sorting.md](briefs/admin-orders-dashboard-ux-mobile-and-status-sorting.md)

---

## What Was Delivered

- **Status-first display ordering on `/admin`:** Orders now render in this priority order:
  - `aguardando_confirmacao`
  - `em_preparo`
  - `entregue`
  - unknown statuses last
- **Tie-breaker ordering:** Within each status group, orders remain **oldest -> newest** by creation timestamp.
- **Mobile accordion details (`< 768px`):** On mobile viewport (Tailwind `md` threshold), order details expand inline in the list.
- **Single-expand mobile behavior:** Only one mobile accordion row can be expanded at a time.
- **Mobile status progression:** Employees can progress order status from the expanded mobile accordion details using the existing forward-only workflow.
- **Desktop behavior preserved:** Existing desktop master/detail interaction remains available while using the same status-first ordering.
- **Scoped UI polish:** `/admin` list/details presentation was refined for readability and touch usability without changing feature scope.
- **Accessibility hardening (Stage 4):**
  - mobile accordion trigger/panel linkage (`aria-controls`)
  - expanded panel `role="region"` + `aria-labelledby`
  - no misleading accordion `aria-expanded` state on desktop mode

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Admin dashboard page | `app/admin/page.tsx` |
| Dashboard UI (sorting + mobile accordion + details/actions) | `components/admin-orders-dashboard.tsx` |
| Status progression server action (unchanged behavior) | `app/admin/actions.ts` |
| Shared order parsing/status helpers | `lib/orders.ts` |
| Dashboard UI tests (including mobile accordion + sorting) | `components/admin-orders-dashboard.test.tsx` |
| Page/server load tests | `app/admin/page.test.tsx` |
| Stage 4 hardening notes | `docs/hardening-notes.md` |

---

## Decisions (Locked)

- **Feature scope:** UX improvements only for the existing `/admin` employee orders dashboard.
- **Status-first display ordering:** `aguardando_confirmacao` -> `em_preparo` -> `entregue` -> unknown statuses.
- **Tie-breaker ordering:** oldest-first within each status group.
- **Unknown status fallback ordering:** after known statuses, oldest-first.
- **Mobile viewport definition:** `< 768px` (Tailwind `md` breakpoint threshold).
- **Mobile interaction:** inline accordion inside the order list.
- **Accordion expansion behavior:** single-expand only.
- **Sorting parity:** same status-first ordering on mobile and desktop.
- **Status progression/stale handling/auth:** unchanged from the employee dashboard feature.
- **Language:** pt-BR for all employee-facing UI/messages.

---

## Known Gaps & Deferred Work

- **No realtime/polling:** Sorting and accordion behavior operate on the existing static load + local update flow; no TanStack Query/Supabase Realtime in this feature.
- **No viewport visual regression tests:** Behavior is covered via `matchMedia`-based component tests, but no screenshot/integration tests exist for mobile/desktop layout rendering.
- **Duplicate mobile/desktop detail rendering on mobile:** The desktop detail panel remains mounted and hidden while mobile accordion content renders inline. Acceptable for current scale; can be optimized later if detail content grows.
- **No accordion interaction telemetry:** There are no metrics/logs for mobile accordion usage or UX events.
- **No advanced mobile polish (animation/scroll anchoring):** After status progression, reordered rows remain functional but are not animated or scroll-anchored.

---

## Operational Notes

- **No migrations required:** This is a UI-only feature (no schema/RLS/auth changes).
- **Sorting is display-layer only:** The DB query in `app/admin/page.tsx` remains unchanged; status-first ordering is applied in the dashboard component.
- **Responsive breakpoint behavior:** Mobile accordion mode is determined client-side with `window.matchMedia("(max-width: 767px)")`.
- **Manual smoke test checklist:**
  - Desktop `/admin`: confirm status-first ordering + details panel still works
  - Mobile `/admin` (or responsive devtools `<768px`): confirm inline accordion, single-expand behavior, and status progression
  - Confirm summary counts remain correct after progression

---

## For the Next Engineer

- **If you add polling/realtime:** Re-test mobile accordion state behavior when the list reorders due to background updates (expanded row identity/state can become tricky).
- **If you move sorting server-side:** Keep the exact display contract (status priority + oldest-first tie-breaker + unknown-last fallback) and update tests accordingly.
- **If you extract a shared accordion component:** Preserve the current a11y semantics (`aria-controls` + labeled `region`) and port the existing tests.
- **If you optimize mobile rendering:** Consider conditionally unmounting the hidden desktop detail panel on mobile to reduce duplicate rendering work.
