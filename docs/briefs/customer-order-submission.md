# Feature Brief — Customer Order Submission

Status: Stage 0 — Framing
Date: 2026-02-23
Author: Orchestrator Agent

---

## Alternative Name

Fluxo de pedido do cliente / Cardápio + checkout / Envio de pedido público

---

## Problem

The employee flow is now functional (`/admin` dashboard + order status progression), but customers still cannot place orders. The public route (`/`) remains a placeholder and does not let customers browse menu items, select multiple items, provide contact details, or create an order in Supabase. Without the customer submission flow, the app cannot generate real orders for the employee dashboard to process.

---

## Goal

Deliver the first public customer ordering flow on `/` that:
- Reads the menu from a local JSON file (menu config)
- Lets a customer select multiple items and quantities
- Collects required customer contact fields (`nome`, `e-mail`, `telefone`)
- Submits a new order to Supabase `public.orders`
- Creates orders with canonical initial status `aguardando_confirmacao`
- Uses Portuguese (pt-BR) for all customer-facing UI and validation/error messages

Success = a customer can open `/`, add items, fill required contact fields, submit, and a new row appears in `public.orders` with `status = aguardando_confirmacao` and item data visible in `/admin`.

---

## Who

- **Customers (public users):** Browse the menu, choose items, and submit an order without creating an account.
- **Employees (indirect):** Receive newly submitted orders in `/admin` and can process them using the existing dashboard.
- **Developers/operators:** Maintain the menu JSON file and ensure Supabase env vars are configured.

---

## What We Capture / Change

- **Customers table (new):** Introduce `public.customers` to store customer contact records for reuse/history.
- **Menu source (JSON):** Introduce a local JSON file for the menu (path and schema locked below).
- **Customer inputs (required):**
  - `customer_name`
  - `customer_email`
  - `customer_phone`
- **Order/customer linkage:** New orders must reference a customer record (linking strategy locked below; exact columns and constraints defined in implementation/migration).
- **Orders schema change (locked):** Add `public.orders.customer_id uuid null references public.customers(id)` in this feature.
- **Customer snapshot on order:** `public.orders` keeps a snapshot of submitted contact fields (`customer_name`, `customer_email`, `customer_phone`) even when linked to `public.customers` (for history/audit and dashboard compatibility).
- **Order items payload:** Persist to `public.orders.items` as a JSON array of objects with at minimum:
  - `name` (string)
  - `quantity` (positive integer)
- **Optional customer note:** If included in UI in this feature, map to `orders.notes`; otherwise omit (non-goal unless explicitly implemented).
- **Supabase insert:** Create rows in `public.orders` with:
  - `status = aguardando_confirmacao`
  - generated `reference` handled by DB default
  - `created_at`/`updated_at` handled by DB defaults/triggers
  - customer linkage to `public.customers`
- **Migration compatibility (existing rows):** Because `public.orders` already exists and may contain rows, `orders.customer_id` is introduced as **nullable** in this feature. New customer-submitted orders must always set `customer_id`; legacy rows may remain `NULL` until a later backfill brief.

---

## Success Criteria

- [ ] Public route `/` renders a customer menu sourced from a local JSON file.
- [ ] Customer can add multiple menu items and adjust quantities before submission.
- [ ] Customer can remove an item (or reduce quantity to zero) from the selection.
- [ ] Customer must provide `nome`, `e-mail`, and `telefone`; empty fields are validated in Portuguese before submission.
- [ ] Customer cannot submit an order with zero selected items.
- [ ] Submitting a valid order creates or reuses a `public.customers` record for the provided contact data (per locked matching rule).
- [ ] Submitting a valid order inserts a row into `public.orders` with canonical status `aguardando_confirmacao`.
- [ ] Inserted order row stores both the `customer_id` link and the submitted contact snapshot fields (`customer_name`, `customer_email`, `customer_phone`).
- [ ] Inserted `items` payload is compatible with the existing `/admin` dashboard item rendering (`name` + `quantity`).
- [ ] After successful submission, the UI shows a clear Portuguese success state/message and resets the form/selection (or clearly indicates the order was sent).
- [ ] Order submission failures show a clear Portuguese error message without leaking internal details.
- [ ] All customer-facing labels, buttons, validation, and messages are in Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- In-app payment processing or price charging.
- Customer accounts, customer login, or order history.
- Delivery fee, address capture, geolocation, or checkout calculations beyond item quantities.
- Coupon codes, discounts, taxes, or advanced pricing rules.
- Real-time order updates for customers after submission.
- Menu management UI (menu remains JSON-only).
- Inventory/stock checks.
- Editing/canceling customer orders after submission.

---

## Acceptance Scenarios

### Happy Paths

1. **Customer sees menu and selects items.** Customer opens `/`, sees menu items loaded from JSON, and adds multiple items with quantities to the current selection.
2. **Customer submits valid order.** Customer selects one or more items, fills `nome`, `e-mail`, `telefone`, and submits. The app inserts a row into `public.orders` with `status = aguardando_confirmacao`, customer fields, and `items` array. Customer sees a Portuguese success message.
3. **Customer record is tracked.** On successful submission, the app creates (or reuses) a row in `public.customers` and links the new order to that customer.
4. **Employee sees submitted order in dashboard.** After submission, an authenticated employee opens `/admin` and sees the new order in the list with the expected item names/quantities and status `Esperando confirmação`.

### Unhappy Paths

1. **No items selected.** Customer tries to submit without any selected items. The app blocks submission and shows a Portuguese validation message.
2. **Missing required customer fields.** Customer submits with one or more empty fields (`nome`, `e-mail`, `telefone`). The app blocks submission and shows Portuguese validation messages.
3. **Supabase unavailable / insert fails.** The insert operation fails. The app shows a Portuguese error message and preserves the current form/cart so the customer can retry.
4. **Supabase env vars missing.** If Supabase is not configured, the page does not crash; show a Portuguese setup/unavailable message (or disable submission) instead of throwing.

---

## Edge Cases

- **Quantity boundaries:** Repeatedly adding the same item increases quantity; reducing quantity to zero removes the item from the selection.
- **Menu item with missing optional fields:** If a menu item lacks optional display data (e.g. description), the menu still renders.
- **Legacy/seed data compatibility:** New customer-submitted orders must use `items` shape compatible with the existing employee dashboard parser (`name` + `quantity`).
- **Repeat customer submissions:** A returning customer submitting again should not create duplicate customer rows when the locked match rule identifies the same person.
- **Legacy orders without customer link:** Existing rows in `public.orders` with `customer_id = NULL` (before this feature) must continue to render in `/admin` without breaking the employee dashboard.
- **Double submit:** Customer clicks submit multiple times while the request is in flight; app should prevent duplicate submissions from the same UI interaction.
- **Invalid email format:** Basic browser/email input validation is acceptable for this brief; no deep email verification required.

---

## Approach (High-Level Rationale)

1. **Menu JSON (locked path/schema).** Add a local JSON file (recommended `data/menu.json`) and load it on `/`. The file is the source of truth for menu display in this feature.
2. **Customer page on `/`.** Replace the placeholder on `app/page.tsx` with a public menu + selection + checkout form flow. Keep it client-friendly and simple.
3. **Local selection state.** Maintain selected items and quantities in local component state. Persist only on final submission (no server-side cart/session needed).
4. **Server-side write path.** Use a server action (preferred) or route handler to (a) normalize customer contact values per the locked rules, (b) create/reuse a `public.customers` row, and (c) insert into Supabase `public.orders` with canonical `aguardando_confirmacao`, `customer_id`, and customer snapshot fields. Keep DB writes off the client if practical in this repo setup.
5. **Validation + UX safety.** Validate required fields and non-empty selection before calling Supabase. Disable the submit button while request is in progress to prevent duplicate orders.
6. **Portuguese UX.** All customer-facing copy, labels, validation, and success/error messages must be pt-BR.
7. **Compatibility with employee dashboard.** Persist `items` as a JSON array of `{ name, quantity }` objects so `/admin` displays submitted items without additional mapping.
8. **Migration ordering + naming.** Use full numeric timestamp prefixes for new Supabase migrations (e.g. `YYYYMMDDHHMMSS_*`) to avoid `schema_migrations` version collisions. In this feature, create `public.customers` first, then alter `public.orders` to add nullable `customer_id`, then update app inserts to populate `customer_id` for new orders.

---

## Decisions (Locked)

- **Route:** Customer order submission flow lives on the existing public route `/`.
- **Menu source:** Menu comes from a local JSON file at `data/menu.json` in this feature.
- **Customers tracking:** Add a new `public.customers` table in this feature to track customer contact records.
- **Orders/customer link column:** Add `public.orders.customer_id uuid null references public.customers(id)` in this feature; `NULL` is allowed for pre-existing legacy orders only.
- **Customer match rule (dedupe normalization):**
  - `email`: trim + lowercase before matching and persistence in `public.customers`
  - `phone`: trim + keep digits only before matching in `public.customers`
  - If normalized `email` + normalized `phone` match an existing customer, reuse that row; otherwise create a new row
- **Persisted order target:** Customer submissions insert into `public.orders` (existing table), link to `public.customers` via `customer_id`, and retain submitted contact snapshots on the order row; no separate staging table.
- **Initial status:** New customer orders are always created with `status = aguardando_confirmacao`.
- **Items payload shape:** Persist `orders.items` as JSON array entries with at minimum `{ name, quantity }` to match employee dashboard rendering.
- **Customer auth:** Customers do not log in and do not create accounts.
- **Language:** All customer-facing UI/messages are Portuguese (pt-BR).
- **Migration filenames:** New Supabase migrations for this feature use full timestamp prefixes (`YYYYMMDDHHMMSS_*`).

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
