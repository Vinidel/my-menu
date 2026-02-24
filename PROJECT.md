# Project Brief — Burger Ordering App (my-menu)

> This file is the single source of truth for this project.
> Every agent reads this before starting any stage.
> Keep it updated as the project evolves.

Last updated: 2026-02-24

---

## What We Are Building

A **small-scale burger ordering app** for a friend’s burger place in **Brazil**. The app is in **Portuguese** (UI, labels, messages, and any user-facing content). Limited features: **customers** place orders (select multiple items and submit with contact details), and the **burger owner/employees** track orders and update their status. The menu is driven by a JSON config file. Employees sign in with email and password. Infrastructure is Supabase (auth, database) and hosting is on Vercel.

---

## Who It Is For

| User Type | What They Need |
|-----------|----------------|
| **Customers** | A page to browse the menu (from JSON), select multiple items, enter name / email / phone (all required), and submit an order to the burger place. |
| **Burger owner / employees** | Login with email and password; a view to see incoming orders and update each order’s status (e.g. received, preparing, ready, completed). |

---

## What It Is Not

- **Not a public marketplace.** Single burger place, small scale; no multi-tenant or multi-restaurant support for now.
- **Not a full POS or inventory system.** No stock management, no payments in-app (handled outside the app for now).
- **Not a generic white-label product.** Scope is intentionally limited to this one use case.

---

## Current Status

- **Delivered:** App Skeleton (Next.js, Tailwind, shadcn, Vitest, `/` and `/admin` placeholders), Employee Auth (Supabase email/password login, protected `/admin`, `/admin/login`, logout), Employee Orders Dashboard (`/admin` summary/list/details/status progression), Supabase `orders` schema + seed and DB-enforced status transitions, Customer Order Submission (`/` menu/cart/checkout, `public.customers`, `/api/orders`, service-role submission path), API Orders Anti-Abuse (`POST /api/orders` rate limiting, `429` + `Retry-After`, hashed source keys, degrade-open fallback).
- **Docs:** Feature briefs in `docs/briefs/`; delivery notes in `docs/employee-auth.md`, `docs/employee-orders-dashboard.md`, `docs/customer-order-submission.md`, and `docs/api-orders-anti-abuse.md`. Implementation and hardening notes in `docs/implementation-notes.md` and `docs/hardening-notes.md`.
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

- **Customer flow:** Public menu page (data from JSON) → tabbed cardápio/pedido UX → cart/selection → checkout form (name, email, phone required; optional notes) → `POST /api/orders` (server-only service-role write path + anti-abuse rate limiting) → order submission. Orders stored in Supabase.
- **Employee flow:** Login (Supabase Auth, email + password) → orders list → update order status. Only authenticated users can access the owner/employee area.
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
├── docs/                ← briefs/, critique.md, implementation-notes.md, hardening-notes.md, employee-auth.md, employee-orders-dashboard.md, customer-order-submission.md, api-orders-anti-abuse.md (feature docs)
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
- **Stage labels (PRs):** `stage-1-impl`, `stage-2-tests`, `stage-3-refactor`, `stage-4-hardening`, `ready-for-review`.

### Data Layer

- Supabase as single source for orders and auth. Use Supabase client (and RLS) for access control. Menu is read from JSON, not from DB in initial scope.

### Error Handling

- Validate required customer fields (name, email, phone) before submission. Use clear, user-facing messages for auth and order errors; avoid leaking internal details. Public order submission uses `/api/orders` with server-side validation and service-role DB writes.

### API Design

- Prefer Supabase client and, if needed, Edge Functions. No separate REST API layer unless a brief specifies it. Response shapes should be consistent and minimal.

### State Management

- Prefer Next.js server components and Supabase client; local state (e.g. `useState`) for UI. Avoid heavy global state unless a brief requires it.

### Language / Locale

- **Portuguese (Brazil).** All user-facing text — UI labels, buttons, form placeholders, validation messages, order status labels, and any copy — must be in Portuguese. No multi-language or locale switching in initial scope; the app is single-locale (pt-BR).

### Patterns for This Repo

- **Agents and workflow.** Use the 6-stage workflow and agent rules in `.cursor/rules/` and `workflow/WORKFLOW.md` for all feature work. Feature work starts with a brief in `docs/briefs/`.
- **Menu config.** Menu is configured via a JSON file; schema and location will be defined in a feature brief. No DB-backed menu in initial scope.
- **Auth scope.** Only employees (burger owner/staff) need login. Customers do not have accounts; they only provide name, email, and phone when placing an order.

---

## Key Decisions (Locked)

| Decision | Rationale |
|----------|-----------|
| Supabase for data and auth | Single provider for DB and email/password auth; fits small scale and Vercel deployment. |
| Vercel for hosting | Simple deploy and good fit for a small full-stack or frontend app. |
| Menu from JSON file | Keeps initial scope small; no admin UI for menu; easy to change menu by editing config. |
| Customer order writes via server-only `/api/orders` + service role | Returns proper HTTP status codes and avoids exposing direct public table reads/writes for orders/customers. |
| Employees login with email + password | Simple auth model for owner and staff; Supabase Auth supports it out of the box. |
| Customer contact fields required (name, email, phone) | Ensures the burger place can identify and reach the customer for every order. |
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
