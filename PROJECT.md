# Project Brief — Burger Ordering App (my-menu)

> This file is the single source of truth for this project.
> Every agent reads this before starting any stage.
> Keep it updated as the project evolves.

Last updated: 2026-03-10

---

## What We Are Building

A **small-scale burger ordering app** for a friend’s burger place in **Brazil**. The app is in **Portuguese** (UI, labels, messages, and any user-facing content). Limited features: **customers** place orders (select multiple items and submit with contact details), and the **burger owner/employees** track orders and update their status. The menu is driven by a JSON config file. Employees sign in with email and password. Infrastructure is Supabase (auth, database) and hosting is on Vercel.

---

## Who It Is For

| User Type | What They Need |
|-----------|----------------|
| **Customers** | A page to browse the menu (from JSON), select multiple items, enter name / phone (required) plus optional email, and submit an order to the burger place. |
| **Burger owner / employees** | Login with email and password; a view to see incoming orders and update each order’s status (e.g. received, preparing, ready, completed). |

---

## What It Is Not

- **Not a public marketplace.** Single burger place, small scale; no multi-tenant or multi-restaurant support for now.
- **Not a full POS or inventory system.** No stock management, no payments in-app (handled outside the app for now).
- **Not a generic white-label product.** Scope is intentionally limited to this one use case.

---

## Current Status

- **Delivered:** App Skeleton (Next.js, Tailwind, shadcn, Vitest, `/` and `/admin` placeholders), Employee Auth (Supabase email/password login, protected `/admin`, `/admin/login`, logout, plus first-login `/admin/login` -> `/admin` redirect reliability bugfix), Employee Orders Dashboard (`/admin` summary/list/details/status progression), Admin Orders Dashboard UX Enhancements (status-first sorting on `/admin`, mobile accordion details, single-expand mobile behavior), Admin Orders Dashboard Polling (TanStack Query polling on `/admin`, protected `GET /api/admin/orders`, hidden-tab pause/resume behavior), Admin Order Total Amount Display (`/admin` order details total with pt-BR currency formatting, legacy `Indisponível` fallback, snapshot-based totals), Supabase `orders` schema + seed and DB-enforced status transitions, Admin Delivery Status Step (`/admin` delivery-only `Saiu para entrega` step, delivery-aware status ordering/summary counts, and DB-enforced delivery-only transition integrity), Admin Ready-for-Pickup Status Step (`/admin` pickup/legacy-only `Pronto para retirada` step, pickup-aware status ordering/summary counts, and DB-enforced pickup-only transition integrity), Tech Review + First Data Access Abstraction (first `admin/orders` persistence boundary, Supabase-backed adapter, and migrated `/admin` load/polling/status-progression call sites), Provider-Agnostic Data Access and Client Naming Follow-Up (app-facing browser/request/privileged client entrypoints, migrated locked `app/**` + `components/**` imports, and explicit `client-only` / `server-only` fences), Customer Order Submission (`/` menu/cart/checkout, `public.customers`, `/api/orders`, service-role submission path), Customer Cart Visibility / Feedback (`Carrinho` naming, explicit cart entry labels, add-to-cart feedback highlight, mobile sticky cart tabs), Customer Menu Mobile Overflow Bugfix (`/` cardápio mobile overflow fix via wrapping/stacking/min-width guards), Menu-Inspired Design Review and Implementation (customer `/` visual refresh with menu-inspired tokenized theme + admin status-summary color alignment), Customer Menu Phone Display + BR Mask/Validation (store phone on `/` from env, BR phone mask UX, server-authoritative BR validation + normalized phone persistence), API Orders Anti-Abuse (`POST /api/orders` rate limiting, `429` + `Retry-After`, hashed source keys, degrade-open fallback), API Orders Turnstile CAPTCHA (invisible challenge, server-side token verify, production-enforced CAPTCHA with non-prod toggle), Order Item Extras / Customization (menu extras in JSON, customer extras selection/editing, server-validated extras snapshots, `/admin` extras display), Order Standard Ingredients Removal (`Sem` customization per item, payload/server validation + snapshots, `/admin` removed-ingredients display), Order Payment Method Selection (required `modo de pagamento` on checkout, `orders.payment_method`, `/admin` payment method details display), Customer E-mail Optional (checkout e-mail optional, server validation/dedupe upgrade rules, nullable e-mail storage with canonical `NULL` and `/admin` fallback), Order Delivery Option (required checkout fulfillment choice with fixed `R$ 5,00` delivery fee, persisted `orders.fulfillment_type` + `delivery_fee_cents`, `/admin` fulfillment details display), Cash Change Placeholder (`Observações` placeholder now explicitly includes `troco para R$ 50` while notes remain plain free text), and Menu Import Server Worker (PGMQ queue + Supabase scheduler/Edge worker primary path, browser poller reduced to UI refresh-only, owner-only fallback endpoint retained during rollout).
- **Docs:** Feature briefs in `docs/briefs/`; delivery notes in `docs/employee-auth.md`, `docs/admin-login-redirect-bugfix.md`, `docs/employee-orders-dashboard.md`, `docs/admin-orders-dashboard-ux-mobile-and-status-sorting.md`, `docs/admin-orders-dashboard-polling-tanstack-query.md`, `docs/admin-order-total-amount-display.md`, `docs/admin-delivery-status-step.md`, `docs/admin-ready-for-pickup-status-step.md`, `docs/tech-review-data-access-abstraction.md`, `docs/provider-agnostic-data-access-and-client-naming-follow-up.md`, `docs/customer-order-submission.md`, `docs/customer-cart-visibility-feedback.md`, `docs/customer-menu-mobile-overflow-bugfix.md`, `docs/menu-inspired-design-review-and-implementation.md`, `docs/customer-menu-phone-display-and-br-mask-validation.md`, `docs/api-orders-anti-abuse.md`, `docs/api-orders-turnstile-captcha.md`, `docs/order-item-extras-customization.md`, `docs/order-standard-items-removal.md`, `docs/order-payment-method-selection.md`, `docs/customer-email-optional.md`, `docs/order-delivery-option.md`, `docs/cash-change.md`, and `docs/menu-generation-from-owner-image.md`. Implementation and hardening notes in `docs/implementation-notes.md` and `docs/hardening-notes.md`.
- Workflow: 6-stage delivery with agents (see `workflow/WORKFLOW.md`).

---

## Tech Stack

### Language & Frameworks

- **Frontend:** Next.js (App Router). Styling with Tailwind CSS; UI components from shadcn/ui.
- **Backend / data / auth:** Supabase (PostgreSQL, Auth, optional Realtime).

### Infrastructure & Cloud

- **Supabase** — Database, authentication (email/password for employees), and any server-side logic (e.g. Edge Functions if needed).
- **Vercel** — Hosting for the app (frontend and/or full-stack).

### Key Libraries & Tools

- **Next.js** — App Router, React Server Components where appropriate.
- **Tailwind CSS** — Styling; follow Tailwind conventions and avoid inline styles for layout/theme.
- **shadcn/ui** — UI components (buttons, forms, dialogs, etc.); use existing components from `components/ui/` and add new ones via shadcn CLI when needed.
- **Supabase** — Client for data and auth.
- **Menu** — JSON file (path/schema to be defined in a feature brief).

### Testing

- **Vitest** — Unit and component tests. Use Testing Library (e.g. `@testing-library/react`) for component tests. Tests derived from feature brief acceptance scenarios.

### CI/CD

- Vercel deployment (e.g. Git integration). GitHub Actions or similar can be added later if needed.

---

## Architecture Overview

- **Customer flow:** Public menu page (data from JSON, including optional additive extras and removable ingredients) → tabbed `Cardápio` / `Carrinho` UX with explicit cart count and add-feedback highlight (mobile sticky cart tabs) → responsive mobile-safe cardápio card layout (wrapping/stacking/min-width guards to prevent horizontal overflow) → cart/selection (line items may include extras and `Sem ...` removals) → checkout form (name and phone required, email optional; optional notes; required `modo de pagamento`; required `Tipo de entrega` with default `Retirada`) → `POST /api/orders` (server-only service-role write path + anti-abuse rate limiting + server extras/removals/pricing validation + payment method validation + fulfillment validation + optional-email dedupe/upgrade validation) → order submission. Orders store backward-compatible item pricing snapshots for reliable admin totals, persist canonical `payment_method`, persist `fulfillment_type` plus `delivery_fee_cents`, and store missing e-mail as `NULL`.
- **Employee flow:** Login (Supabase Auth, email + password) → `/admin` dashboard (status-first sorted list, mobile accordion on `<768px`, TanStack Query polling auto-refresh via protected `GET /api/admin/orders`) → update order status. The admin orders list/polling/status-progression slice now goes through a dedicated `admin/orders` data-access boundary with a Supabase-backed adapter, while auth/session checks remain at the route/action/page edge. App-layer client access now also goes through provider-agnostic browser/request/privileged entrypoints, with explicit `client-only` / `server-only` fences on those modules. Menu imports are processed asynchronously via Supabase queue worker; admin UI poller only refreshes status. Only authenticated users can access the owner/employee area.
- **Menu:** Sourced from a JSON config file (path and schema to be defined); no menu management UI in initial scope.
- **Hosting:** App deployed on Vercel; Supabase used for all persistent data and auth.

---

## Folder Structure

```
/
├── .cursor/
│   └── rules/           ← Agent rules (orchestrator, implementer, tester, refactorer, hardener, documenter, critic)
├── workflow/
│   └── WORKFLOW.md      ← 6-stage workflow and PR lifecycle
├── templates/           ← feature-brief, PROJECT, pull-request templates
├── docs/                ← briefs/, critique.md, implementation-notes.md, hardening-notes.md, employee-auth.md, admin-login-redirect-bugfix.md, employee-orders-dashboard.md, admin-orders-dashboard-ux-mobile-and-status-sorting.md, admin-orders-dashboard-polling-tanstack-query.md, admin-order-total-amount-display.md, tech-review-data-access-abstraction.md, provider-agnostic-data-access-and-client-naming-follow-up.md, customer-order-submission.md, customer-cart-visibility-feedback.md, customer-menu-mobile-overflow-bugfix.md, api-orders-anti-abuse.md, api-orders-turnstile-captcha.md, order-item-extras-customization.md, order-standard-items-removal.md, order-payment-method-selection.md, customer-email-optional.md (feature docs)
├── PROJECT.md           ← This file: project context and patterns
├── app/                 ← Next.js App Router (routes, layouts, pages)
├── components/          ← React components; components/ui/ for shadcn
├── lib/                 ← Utilities, Supabase client, shared logic
└── [menu.json, etc.]    ← Menu config and other static data as needed
```

---

## Conventions & Patterns

### Naming

- **Code:** PascalCase for React components; camelCase for variables/functions. Follow Next.js and React conventions.
- **Files:** Next.js App Router — `page.tsx`, `layout.tsx`, `loading.tsx`; components as `PascalCase.tsx`; other modules kebab-case or camelCase as appropriate.
- **Stage labels (PRs):** `stage-1-impl`, `stage-2-tests`, `stage-3-refactor`, `stage-4-hardening`, `stage-5-review`.

### Data Layer

- Supabase remains the single source for orders and auth. Menu is read from JSON, not from DB in initial scope.
- For the first extracted boundary, `admin/orders` persistence now goes through a domain-specific data-access interface with a Supabase adapter. Auth/session validation is still handled outside that boundary in route/action/page code.
- App-layer client construction for the migrated slice now goes through provider-agnostic entrypoints (`lib/browser-client.ts`, `lib/request-client.ts`, `lib/privileged-client.ts`, `lib/request-and-privileged-clients.ts`) rather than direct `lib/supabase/*` imports, while internal library code may still depend on Supabase-specific modules.

### Error Handling

- Validate required customer fields (name and phone) before submission; e-mail is optional but must be valid when provided. Use clear, user-facing messages for auth and order errors; avoid leaking internal details. Public order submission uses `/api/orders` with server-side validation and service-role DB writes.

### API Design

- Prefer Supabase client and, if needed, Edge Functions. No separate REST API layer unless a brief specifies it. Response shapes should be consistent and minimal.

### State Management

- Prefer Next.js server components and Supabase client; local state (e.g. `useState`) for UI. Avoid heavy global state unless a brief requires it.

### Language / Locale

- **Portuguese (Brazil).** All user-facing text — UI labels, buttons, form placeholders, validation messages, order status labels, and any copy — must be in Portuguese. No multi-language or locale switching in initial scope; the app is single-locale (pt-BR).

### Patterns for This Repo

- **Agents and workflow.** Use the 6-stage workflow and agent rules in `.cursor/rules/` and `workflow/WORKFLOW.md` for all feature work. Feature work starts with a brief in `docs/briefs/`.
- **Menu config.** Menu is configured via a JSON file (including additive extras per item); schema evolves via feature briefs. No DB-backed menu in initial scope.
- **Auth scope.** Only employees (burger owner/staff) need login. Customers do not have accounts; they provide name and phone (required) plus optional e-mail when placing an order.

---

## Key Decisions (Locked)

| Decision | Rationale |
|----------|-----------|
| Supabase for data and auth | Single provider for DB and email/password auth; fits small scale and Vercel deployment. |
| Vercel for hosting | Simple deploy and good fit for a small full-stack or frontend app. |
| Menu from JSON file | Keeps initial scope small; no admin UI for menu; easy to change menu by editing config. |
| Customer order writes via server-only `/api/orders` + service role | Returns proper HTTP status codes and avoids exposing direct public table reads/writes for orders/customers. |
| Employees login with email + password | Simple auth model for owner and staff; Supabase Auth supports it out of the box. |
| Customer contact fields required (name, phone; email optional) | Ensures the burger place can identify and reach the customer for every order while reducing checkout friction. |
| Single burger place, limited features | App is for a friend’s place; avoid scope creep and multi-tenant complexity. |
| Portuguese (pt-BR) as app language | App is used in Brazil; all UI and user-facing content in Portuguese, no locale switching. |
| Next.js + Tailwind + shadcn + Vitest | Frontend stack: Next.js App Router, Tailwind for styling, shadcn/ui for components, Vitest for tests. |

---

## Known Constraints

- **Small scale.** Design for low concurrency and a single tenant (one burger place).
- **No in-app payments.** Payments are out of scope for now; handled outside the app.
- **Agents and workflow.** All feature work follows the repo’s workflow and agent rules; briefs and PRs use the existing templates and stage labels.

---

## Out of Scope for Now

- Multi-restaurant or multi-tenant support.
- Customer accounts or login for customers.
- In-app payment processing.
- Inventory or stock management.
- Admin UI to edit the menu (menu is JSON-only for now).
- Native mobile apps (web-only unless a later brief says otherwise).

---

## Glossary

| Term | Meaning |
|------|--------|
| **Brief** | Feature brief produced in Stage 0; defines problem, success criteria, and approach. Stored in `docs/briefs/`. |
| **Employee** | Burger owner or staff; has email/password login and can view/update orders. |
| **Menu (JSON)** | Configuration file that defines the burger place’s menu items; structure defined in a feature brief. |
| **Order status** | State of an order (e.g. received, preparing, ready, completed); employees can update it. Labels and UI in Portuguese. |
| **pt-BR** | Portuguese (Brazil); the app’s single language for all user-facing content. |
| **Exit gate** | Condition to pass before the next stage (e.g. Critic approval); see `workflow/WORKFLOW.md`. |
| **Stage** | One of 0 (Brief), 1 (Implement), 2 (Test), 3 (Refactor), 4 (Harden), 5 (Document). |
