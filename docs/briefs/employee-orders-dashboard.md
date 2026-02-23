# Feature Brief — Employee Orders Dashboard

Status: Stage 0 — Framing
Date: 2026-02-23
Author: Orchestrator Agent

---

## Alternative Name

Admin orders dashboard / Painel de pedidos (funcionários)

---

## Problem

Authentication for employees is already implemented, but authenticated users still do not have a practical dashboard to manage incoming orders. Employees need a single authenticated page where they can quickly understand the current workload (how many orders are waiting / in preparation / delivered), view orders in chronological order, open an order to inspect details, and progress its status. Without this, the employee flow stops at login and does not support actual order operations.

---

## Goal

Provide an authenticated employee dashboard in the `/admin` area that:
- Lists orders from **oldest to newest** (based on order creation timestamp)
- Shows summary counts at the top for the statuses **Esperando confirmação**, **Em preparo**, and **Entregue**
- Lets an employee select an order and view its details
- Lets an employee **progress** the order status forward through the defined workflow
- Uses Portuguese (pt-BR) for all user-facing labels/messages

Success = an authenticated employee can open the dashboard, see order counts, inspect an order, and move it to the next status from the UI.

---

## Who

- **Employees (burger owner / staff):** Primary users. They are authenticated and use the dashboard to monitor and progress orders.
- **Customers:** Indirectly affected; they do not access this dashboard.
- **Developers / operators:** Must ensure the orders table/schema supports reading order data and updating status (already existing or created in a separate feature if needed).

---

## What We Capture / Change

- **Read orders** from Supabase for authenticated employees.
- **Display fields** required for list and details.
  - **List (minimum):** order id/reference, creation date/time, customer name, current status.
  - **Details (minimum):** order id/reference, creation date/time, customer name, customer phone, customer email, ordered items (item name + quantity), current status.
  - Optional fields (e.g. notes) should render when present, but are not required for this feature.
- **Update order status** by progressing to the next allowed status.
- **Canonical persisted status values (locked for this feature):**
  - `aguardando_confirmacao`
  - `em_preparo`
  - `entregue`
- **UI labels in pt-BR (locked mapping):**
  - `aguardando_confirmacao` -> `Esperando confirmação`
  - `em_preparo` -> `Em preparo`
  - `entregue` -> `Entregue`
- **Dashboard summary counts** computed for these statuses only:
  - `Esperando confirmação`
  - `Em preparo`
  - `Entregue`
- **No new customer data captured** in this feature.
- **No menu JSON changes** in this feature.

---

## Success Criteria

- [ ] Authenticated employee can access an orders dashboard page in the protected `/admin` area.
- [ ] Dashboard shows a summary section at the top with total counts for `Esperando confirmação`, `Em preparo`, and `Entregue`.
- [ ] Dashboard lists orders in ascending creation order (oldest first, newest last).
- [ ] Each listed order can be selected/clicked to view order details.
- [ ] Order details view shows at minimum: order id/reference, creation date/time, customer name, customer phone, customer email, ordered items (name + quantity), and current status.
- [ ] Employee can progress an order to the next status from the details view (or equivalent order action UI).
- [ ] Progressing an order updates persisted data in Supabase and the dashboard reflects the new status/counts.
- [ ] Invalid or disallowed status progression is prevented in the UI and handled safely in the update path using the locked canonical statuses.
- [ ] Empty-state UI is shown in Portuguese when there are no orders.
- [ ] Errors loading orders or updating status are shown with clear Portuguese messages without leaking internal details.

---

## Non-Goals (Out of Scope)

- Real-time updates (Supabase Realtime / live polling) for order changes.
- Advanced filters, search, sorting options beyond **oldest to newest** default order.
- Pagination / infinite scroll (unless needed for basic rendering due to unexpectedly large data volume).
- Editing order items, customer contact info, or creating orders from the employee dashboard.
- Cancelling orders, reopening delivered orders, or arbitrary status jumps.
- Role-based permissions (owner vs staff); any authenticated employee can view/progress orders.
- Printing, receipts, notifications, or analytics beyond the three top counts.

---

## Acceptance Scenarios

### Happy Paths

1. **Employee sees dashboard summary and list.** Authenticated employee opens the dashboard page under `/admin`. They see top summary totals for `Esperando confirmação`, `Em preparo`, and `Entregue`, and a list of orders sorted from oldest to newest.
2. **Employee opens an order and sees details.** Employee clicks an order in the list. The app shows order details including customer information, ordered items, and current status.
3. **Employee progresses order from waiting to preparing.** An order with status `Esperando confirmação` is opened. Employee clicks the progress action. The order status updates to `Em preparo`, persists in Supabase, and the list/details/top counts update accordingly.
4. **Employee progresses order from preparing to delivered.** An order with status `Em preparo` is opened. Employee clicks the progress action. The order status updates to `Entregue`, persists, and the UI refreshes the status and summary totals.

### Unhappy Paths

1. **Orders load fails.** Supabase query fails (network/server/error). Dashboard shows a Portuguese error message and does not expose raw error internals.
2. **Status update fails.** Employee clicks progress, but the update request fails. Show a Portuguese error message; order remains in previous status in the UI (or UI re-syncs to persisted value).
3. **Unauthorized access.** Unauthenticated user attempts to access the dashboard page. Existing auth protection redirects them to `/admin/login` (defined in the auth feature).
4. **Disallowed progression attempt.** Employee opens an order already in `Entregue` (or an unknown/unsupported status) and the app prevents progression (e.g. disabled button / no action) with safe handling.

---

## Edge Cases

- **No orders yet:** Dashboard shows zero counts and an empty-state message in Portuguese.
- **Mixed/legacy status values in DB:** If historical rows contain unexpected status values, they should not break the dashboard; unknown statuses can still render in details and be excluded from the three summary totals (or mapped explicitly if defined).
- **Missing optional order fields:** If some order rows are missing non-critical fields (e.g. notes), the details view still renders gracefully.
- **Concurrent update by another employee:** If two employees open the same order and one updates status first, the second employee's progression attempt must be rejected by the update path (no blind overwrite), and the UI must refresh/reload the order to show the current persisted status with a Portuguese message.
- **Large item list in one order:** Details view remains readable and usable when an order contains many items.

---

## Approach (High-Level Rationale)

1. **Protected admin page.** Build the dashboard on the existing authenticated route `/admin` (auth is already done). Reuse the current auth guard/layout rather than introducing a new auth mechanism.
2. **Orders query + default ordering.** Read orders from Supabase sorted by creation timestamp ascending (`oldest -> newest`). The exact timestamp column name depends on the existing schema (e.g. `created_at`).
3. **Summary counts.** Compute and display top-level counts for the three operational statuses (`Esperando confirmação`, `Em preparo`, `Entregue`). Counts may be calculated from fetched rows in the page layer for this initial feature; optimization can come later if needed.
4. **Master/detail UI.** Render a list of orders plus a details panel/page/modal for the selected order. Exact presentation is an implementation choice, but selection must be clear and support status progression.
5. **Status progression rule (locked for this feature).** Persist and validate only canonical statuses:
   - `aguardando_confirmacao` -> `em_preparo`
   - `em_preparo` -> `entregue`
   - `entregue` -> no further progression
   UI must display the mapped pt-BR labels (`Esperando confirmação`, `Em preparo`, `Entregue`).
6. **Safe updates + feedback.** On status progression, update Supabase, then refresh local UI state/list/counts. Show Portuguese success/error feedback. Prevent duplicate submissions while an update is in progress. For stale/concurrent updates, reject the action and reload the current order state from persistence.
7. **Portuguese UI.** All labels, buttons, status names, empty states, and errors shown to employees must be in pt-BR.

---

## Decisions (Locked)

- **Feature scope:** This feature adds an authenticated employee dashboard for viewing and progressing orders; no order creation or editing beyond status progression.
- **Dashboard route:** The orders dashboard for this feature is the existing protected `/admin` page.
- **Dashboard ordering:** Orders are displayed **oldest to newest** by creation timestamp.
- **Top summary metrics:** The dashboard header shows totals for exactly three statuses: `Esperando confirmação`, `Em preparo`, `Entregue`.
- **Persisted status contract:** Orders use canonical persisted statuses `aguardando_confirmacao`, `em_preparo`, `entregue`; the UI displays mapped pt-BR labels.
- **Status progression flow:** Employees can only move orders forward in this sequence: `aguardando_confirmacao` -> `em_preparo` -> `entregue` (displayed as `Esperando confirmação` -> `Em preparo` -> `Entregue`).
- **No reverse/jump transitions:** Employees cannot move an order backward or skip directly to `Entregue` in this feature.
- **Concurrent updates:** If an order changed since it was opened, the employee's stale progression attempt is rejected and the UI refreshes the order from persisted state before another attempt.
- **Auth dependency:** Dashboard remains under the existing protected `/admin` experience and uses the already-implemented employee authentication.
- **Language:** Employee dashboard UI and user-facing messages are in Portuguese (pt-BR).

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
