# Feature Brief — Modo de Pagamento no Pedido (Customer + Admin)

Status: Stage 5 — Documentation Complete (pending Critic)
Date: 2026-02-24
Author: Orchestrator Agent

---

## Alternative Name

Forma de pagamento no checkout / Modo de pagamento no `/` e `/admin` / Payment method on order

---

## Problem

Customers can currently submit orders on `/` with items, contact details, and optional notes, but there is no structured way to inform **how they intend to pay**. Employees viewing `/admin` also cannot see the intended payment method, which creates operational ambiguity (for example, whether to expect cash, Pix, or card at pickup/delivery).

Right now, payment method may be communicated informally (or not at all), and there is no consistent field stored on the order.

---

## Goal

Add a required **payment method selection** (`modo de pagamento`) to the customer order flow (`/`) using radio buttons with exactly these options:
- `Dinheiro`
- `Pix`
- `Cartão`

Persist the selected value on new orders and display it in `/admin` order details.

Success = customer cannot submit without selecting a payment method, the order stores the canonical payment method value, and employees see the pt-BR payment method label in `/admin` details.

---

## Who

- **Customers (public users):** Need a simple way to indicate intended payment method during order submission.
- **Employees (burger owner / staff):** Need to see the selected payment method in `/admin` order details.
- **Developers/operators:** Must preserve backward compatibility with existing `orders` rows that do not yet have a payment method.

---

## What We Capture / Change

- **Customer checkout UI (`/` / `Seu pedido` tab):**
  - Add a required radio group for `Modo de pagamento`
  - Options (pt-BR labels): `Dinheiro`, `Pix`, `Cartão`
- **Customer submission payload (`/api/orders` + shared submit logic):**
  - Include a payment method field in the server input contract
  - Validate server-side against locked canonical values (do not trust arbitrary client strings)
- **Orders persistence:**
  - Add a new column on `public.orders` to store payment method (schema change locked below)
  - New customer-submitted orders must persist payment method
- **Admin dashboard (`/admin`) order details:**
  - Display `Forma de pagamento` (pt-BR) in order details (desktop + mobile accordion shared details content)
- **Legacy row handling:**
  - Existing `orders` rows without payment method must continue rendering safely in `/admin`
  - Fallback display behavior is locked below

---

## Success Criteria

- [ ] Customer checkout on `/` includes a radio group for `Modo de pagamento` with exactly `Dinheiro`, `Pix`, and `Cartão`.
- [ ] Customer cannot submit without selecting a payment method; a clear Portuguese validation message is shown.
- [ ] Server-side submission validates payment method against locked canonical values and rejects invalid/tampered values.
- [ ] Customer submit payload uses the locked payment method field contract (canonical value, not pt-BR label).
- [ ] New `public.orders` rows persist the selected payment method in a dedicated column.
- [ ] `/admin` order details display `Forma de pagamento` with the correct pt-BR label for new orders.
- [ ] Legacy orders without a stored payment method render safely in `/admin` and use the locked fallback display.
- [ ] Existing order submission behavior (items, extras, notes, anti-abuse, pricing snapshots) remains unaffected.
- [ ] Existing admin behavior (status progression, polling, status-first sorting, totals, extras display) remains unaffected.
- [ ] All new user-facing labels/messages remain in Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Payment processing / charging customers.
- Pix QR generation or Pix key display flows.
- Card machine integration or online card collection.
- Change/`troco` amount collection for cash.
- Split payments / multiple payment methods on one order.
- Fee calculations or payment-status reconciliation.

---

## Acceptance Scenarios

### Happy Paths

1. **Customer selects Pix and submits order.** Customer fills checkout, selects `Pix`, submits successfully, and the order is created with the canonical Pix payment method value.
2. **Customer selects Dinheiro and admin sees it.** Customer submits with `Dinheiro`; employee opens `/admin` and sees `Forma de pagamento: Dinheiro` in order details.
3. **Customer selects Cartão and admin mobile sees it.** On mobile `/admin`, employee expands the order accordion and sees the same payment method information in details content.

### Unhappy Paths

1. **No payment method selected.** Customer tries to submit without selecting a payment method. The app blocks submission and shows a Portuguese validation message.
2. **Tampered client payment method.** Client sends an invalid payment method value not in the locked set. Server rejects submission with a Portuguese validation error and does not create the order.
3. **Legacy order without payment method.** `/admin` opens an older order with no payment method stored; details render normally and payment method uses the locked fallback display.
4. **Unknown stored DB value (manual edit).** `/admin` opens an order whose `payment_method` contains an unexpected value (e.g. `credito`); details render normally and payment method uses the locked fallback display.

---

## Edge Cases

- **Legacy rows:** Existing orders created before this feature may have no payment method column value (`NULL`) and must not break `/admin`.
- **Unknown stored values (manual DB edits):** If `orders.payment_method` contains an unexpected string, `/admin` should render safely and use a deterministic fallback label (locked below).
- **Polling updates in `/admin`:** Payment method display must remain stable during polling refreshes/status progression updates.
- **Duplicate submits:** Existing in-flight submit protection still applies; adding payment method selection must not introduce duplicate order creation regressions.

---

## Approach (High-Level Rationale)

1. **Dedicated column on `orders`.** Persist payment method in a first-class column on `public.orders` instead of hiding it inside `notes` or `items`, because it is a stable order attribute used by operations.
2. **Server-side validation authority.** Customer UI sends a selected value, but the server validates and stores only locked canonical values.
3. **Backward compatibility.** Add the column as nullable so legacy rows remain valid; require it only for newly submitted customer orders.
4. **Admin details-only display.** Show payment method in `/admin` order details (desktop + mobile accordion) without expanding list rows/summaries in this feature.

---

## Decisions (Locked)

- **Customer UI control:** Required radio button group in the checkout form (`Seu pedido` tab).
- **Visible options (pt-BR labels):** `Dinheiro`, `Pix`, `Cartão`.
- **Customer submit payload contract (locked):**
  - field name: `paymentMethod`
  - client sends canonical values only (`dinheiro`, `pix`, `cartao`), not pt-BR labels
- **Canonical persisted values (locked):**
  - `dinheiro`
  - `pix`
  - `cartao`
- **Persistence target:** Add `public.orders.payment_method` in this feature.
- **Column shape (locked):** `public.orders.payment_method text null`
  - `NULL` allowed for legacy rows created before this feature
  - new customer-submitted orders must set a non-null canonical value
- **DB integrity constraint policy (locked):** Add a DB-level `CHECK` constraint in the migration so non-null values in `public.orders.payment_method` must be one of `dinheiro`, `pix`, `cartao` (legacy `NULL` remains allowed).
- **Server validation authority:** `/api/orders` / shared submit logic rejects any payment method outside the locked canonical values.
- **Admin label mapping (locked):**
  - `dinheiro` -> `Dinheiro`
  - `pix` -> `Pix`
  - `cartao` -> `Cartão`
- **Admin fallback display for missing/unknown values (locked):** `/admin` shows `Forma de pagamento: Não informado`.
- **Display scope:** `/admin` order details only (desktop panel + mobile accordion), not list rows or summary cards.
- **Language:** All new labels/messages are pt-BR.
- **Migration filenames:** Use full timestamp prefixes (`YYYYMMDDHHMMSS_*`) for new Supabase migrations.

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
