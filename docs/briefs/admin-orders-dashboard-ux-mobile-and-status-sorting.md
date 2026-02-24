# Feature Brief — Admin Orders Dashboard UX (Mobile Accordion + Status-First Sorting)

Status: Stage 0 — Framing
Date: 2026-02-24
Author: Orchestrator Agent

---

## Alternative Name

Melhorias UX do painel de pedidos / Accordion mobile + ordenação por status no `/admin`

---

## Problem

The employee orders dashboard is functional, but its current interaction model is not optimized for mobile usage and its default ordering (oldest to newest only) can make active work harder during busy periods. On small screens, opening order details in a separate panel/selection flow is less efficient than an inline expandable list pattern. Also, employees often need to prioritize active orders (`aguardando_confirmacao`, `em_preparo`) before already completed ones (`entregue`), regardless of pure chronological order.

Without these UX improvements, the dashboard remains usable but slower for real employee workflows on phones and harder to scan operationally.

---

## Goal

Improve the `/admin` employee orders dashboard UX by:
- Showing order details inline as an accordion item in the order list on **mobile viewport**
- Ordering orders by **status priority first** (`aguardando_confirmacao` -> `em_preparo` -> `entregue`) and then by age within each status group
- Preserving the existing status progression workflow and Portuguese (pt-BR) UI/messages
- Applying a lightweight design polish to the `/admin` page only (spacing/visual hierarchy/readability), without changing feature scope

Success = on mobile, an employee can expand an order directly in the list to see details and progress it; on all viewports, the dashboard lists actionable statuses first while keeping stable oldest-first ordering within each status group.

---

## Who

- **Employees (burger owner / staff):** Primary users. Need faster scanning and order handling on mobile and desktop.
- **Customers:** Indirectly affected only (faster employee processing).
- **Developers/operators:** Maintain the admin dashboard UI; no schema or auth changes expected in this feature.

---

## What We Capture / Change

- **Dashboard ordering logic (display only):**
  - Sort orders by status priority first (locked order below)
  - Then sort by creation timestamp ascending (oldest first) within each status group
- **Mobile order details interaction:**
  - On mobile viewport (`< 768px`, Tailwind `md` breakpoint), each order row can expand/collapse inline (accordion behavior) to show details and available actions
  - Accordion behavior is **single-expand** on mobile (opening one order collapses any other expanded order)
  - The status progression action remains available from the expanded details area
- **Desktop behavior:**
  - Existing master/detail interaction may be preserved or improved, but behavior must remain clear and functional
  - This feature does not require replacing the current desktop interaction with an accordion
  - **Status-first sorting applies on all viewports** (mobile and desktop); only the interaction pattern differs by viewport
- **Design review / polish (scoped):**
  - Improve readability and hierarchy of `/admin` list/details/summaries (spacing, typography emphasis, touch targets, status badge clarity)
  - Keep existing functionality and labels intact
- **No data model/schema changes** in this feature
- **No auth flow changes** in this feature
- **No realtime/polling changes** in this feature

---

## Success Criteria

- [ ] `/admin` displays orders grouped by status priority in this exact order: `aguardando_confirmacao`, `em_preparo`, `entregue`.
- [ ] Within each status priority group, orders remain sorted by creation timestamp ascending (oldest first).
- [ ] Unknown/unsupported statuses do not break rendering and are placed deterministically (locked below).
- [ ] On mobile viewport (`< 768px`, Tailwind `md` breakpoint), an employee can expand/collapse an order inline in the list to view details.
- [ ] Mobile accordion is single-expand (opening one order collapses the previously expanded order).
- [ ] Expanded mobile order details show the same minimum order information currently required by the dashboard (customer info, items, status, etc.).
- [ ] Employees can still progress order status from the mobile expanded view using the existing forward-only flow.
- [ ] Existing summary counts (`Esperando confirmação`, `Em preparo`, `Entregue`) remain correct after sorting/UI changes.
- [ ] Existing Portuguese error/empty/loading feedback remains intact (or improved) and in pt-BR.
- [ ] UI remains usable on both mobile and desktop viewports after the design polish.
- [ ] No behavior regression in status progression, stale update handling, or auth protection.

---

## Non-Goals (Out of Scope)

- Adding realtime updates or polling (TanStack Query / Supabase Realtime).
- Changing database schemas, migrations, or status contracts.
- Adding filters/search/pagination beyond the new status-first default ordering.
- Editing order contents/customer data from `/admin`.
- Redesigning the customer-facing `/` page.
- Introducing a full design system overhaul across the app.

---

## Acceptance Scenarios

### Happy Paths

1. **Employee sees actionable statuses first.** Authenticated employee opens `/admin` and sees `Esperando confirmação` orders first, followed by `Em preparo`, then `Entregue`. Within each section/order priority, older orders appear before newer ones.
2. **Employee expands order inline on mobile.** On a mobile viewport, employee taps an order row and its details expand in place (accordion). They can read order details without switching context.
3. **Single-expand behavior on mobile.** While one order is expanded on mobile, employee taps another order row. The newly tapped order expands and the previously expanded order collapses.
4. **Employee progresses order from mobile accordion.** Employee expands a waiting/preparing order on mobile and uses the existing progression action. Status updates successfully and the order repositions according to the locked sorting rules.
5. **Desktop remains usable with same sort order.** On desktop viewport, employee can still inspect and progress orders without regression (existing interaction preserved or improved), and the status-first ordering matches mobile.

### Unhappy Paths

1. **Orders load fails.** Dashboard still shows a Portuguese error state (existing behavior) and does not break due to the new sorting/accordion UI.
2. **Status update fails/stale update.** Existing Portuguese error/stale handling still works from the mobile expanded view and desktop view.
3. **Unknown status row exists.** Dashboard renders the order safely and places it in the deterministic fallback sort position (locked below).

---

## Edge Cases

- **Many orders on mobile:** Accordion interactions should remain clear and avoid accidental taps (touch target spacing matters).
- **Only delivered orders exist:** Sorting still works and employees can scan historical completed orders.
- **Mixed known + unknown statuses:** Unknown statuses should not corrupt summary counts or break ordering.
- **Order changes status while expanded:** After a successful progression, the order may move to another part of the list due to status-first sorting; UX should remain understandable.
- **Long item lists / notes on mobile:** Expanded content remains readable without breaking layout.

---

## Approach (High-Level Rationale)

1. **Preserve existing data/query contracts.** Reuse the current `/admin` data loading and status progression behavior; apply sorting and mobile interaction changes at the UI/state layer unless a small server-side ordering change is cleaner.
2. **Status-first display sorting.** Introduce a deterministic display sort using the locked status priority map plus a timestamp tie-breaker (oldest first). Keep unknown statuses handled safely and predictably.
3. **Responsive interaction model.** Use an accordion pattern on smaller viewports to reduce context switching. Keep desktop behavior stable to avoid unnecessary regression risk.
4. **Scoped visual polish.** Improve readability/touch usability in `/admin` while keeping all existing features and pt-BR copy intact.
5. **No workflow changes.** Status progression, stale-update handling, and auth remain exactly as implemented in prior features.

---

## Decisions (Locked)

- **Feature scope:** UX improvements for the existing `/admin` employee orders dashboard only.
- **Status-first display ordering (locked):**
  - `aguardando_confirmacao` first
  - `em_preparo` second
  - `entregue` third
- **Tie-breaker ordering:** Within each status group, order by creation timestamp ascending (oldest first).
- **Unknown status fallback ordering:** Unknown/unsupported statuses render after the three known statuses, ordered by creation timestamp ascending.
- **Mobile interaction:** Order details open inline in an accordion pattern within the order list on mobile viewport.
- **Mobile viewport definition (locked):** Mobile accordion behavior applies when viewport width is `< 768px` (Tailwind `md` breakpoint threshold).
- **Accordion expansion behavior (locked):** Mobile accordion is single-expand (only one order can be expanded at a time).
- **Desktop interaction:** Existing desktop interaction may be preserved; no forced accordion requirement on desktop.
- **Sorting viewport parity (locked):** Status-first display ordering applies on both mobile and desktop viewports.
- **Status progression behavior:** Keep existing forward-only progression and stale/concurrent update handling unchanged.
- **Summary counts:** Continue showing exactly three top counts (`Esperando confirmação`, `Em preparo`, `Entregue`) using the existing canonical status mapping.
- **Language:** All employee-facing UI/messages remain in Portuguese (pt-BR).
- **No schema/auth changes:** This feature does not alter Supabase schema, RLS, or employee auth.

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
