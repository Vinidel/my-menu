# Feature Brief — App Skeleton

Status: Stage 1 — Implementation complete (pending Critic)
Date: 2025-02-23
Author: Orchestrator Agent

---

## Alternative Name

Scaffold / Shell / App Shell

---

## Problem

The project is greenfield. There is no runnable application yet. Before implementing any business logic (menu, orders, auth), we need a minimal app shell: routing, layout, styling stack, and placeholder pages for the two main areas (customer-facing and employee-facing). Without this, feature work has no consistent structure to plug into.

---

## Goal

A minimal Next.js application that:

- Runs locally and can be deployed to Vercel.
- Uses the App Router with a root layout and clear route structure for the customer area and the employee area.
- Has Tailwind CSS and shadcn/ui installed and working.
- Shows placeholder pages (no real data, no business rules) so navigation and layout can be verified.
- Uses Portuguese (pt-BR) for any visible text from day one.
- Has a basic Vitest setup so future features can add tests.

Success = the app builds, runs, and a human can open it in the browser and navigate the skeleton without errors. No Supabase, no forms, no menu, no orders.

---

## Who

- **Developers** — primary users of this deliverable (scaffold for future work).
- **End users (customers / employees)** — not directly affected yet; they will use the app only after business features are built on top of this skeleton.

---

## What We Capture / Change

- **No persistent data.** No database, no Supabase client usage, no API routes that write data. Optional: a single static JSON file (e.g. empty or minimal) to confirm the app can read files, but not required for this brief.
- **No auth.** No login, no protected routes, no session. Routes are all reachable; employee area is just a placeholder page.
- **File system:** New `app/` tree, `components/` (including `components/ui/` for shadcn), `lib/` if needed for shared utilities or config. No new business-domain modules.

---

## Success Criteria

- Next.js app runs with `next dev` and builds with `next build` without errors.
- Root layout exists and wraps all routes; global styles (Tailwind) apply.
- At least one customer-facing route exists (e.g. `/` or `/cardapio`) with a placeholder page and Portuguese placeholder text.
- At least one employee-facing route exists (e.g. `/admin` or `/pedidos`) with a placeholder page and Portuguese placeholder text.
- Tailwind CSS is configured and used on placeholder pages.
- shadcn/ui is installed; at least one shadcn component is used on a placeholder page (e.g. Button or Card) to verify the setup.
- All visible UI text is in Portuguese (pt-BR).
- Vitest is configured and at least one trivial test runs (e.g. smoke test or a small utility test); test script runs without error.
- Project structure matches PROJECT.md: `app/`, `components/`, `lib/`; no business logic or Supabase calls.

---

## Non-Goals (Out of Scope)

- **No business logic.** No menu loading, no cart, no order submission, no order status, no real forms.
- **No Supabase.** No client, no env vars for Supabase, no database, no auth.
- **No real navigation UX.** Simple links or Next.js `<Link>` between placeholder pages are enough; no nav bar design requirements beyond "it works."
- **No i18n/locale system.** Single locale (pt-BR); hardcoded Portuguese strings are acceptable.
- **No E2E tests.** Vitest only; Playwright/Cypress out of scope for this brief.
- **No deployment pipeline.** Vercel is the chosen host per PROJECT.md; "can be deployed" means the build succeeds. Actual CI/CD or Vercel project setup is out of scope unless trivial (e.g. `vercel` CLI once).

---

## Acceptance Scenarios

### Happy Paths

1. **Developer runs the app.** Developer runs `npm run dev` (or equivalent). App starts; visiting the root URL shows the customer placeholder page with Portuguese text and correct layout.
2. **Developer navigates to employee area.** From the customer area, developer can reach the employee placeholder page (e.g. via link or URL). Page renders with Portuguese placeholder content and shared layout.
3. **Developer runs tests.** Developer runs the test script (e.g. `npm run test`). At least one test passes; no failing tests from the skeleton itself.
4. **Developer builds for production.** Developer runs the production build command. Build completes successfully; no build-time errors.

### Unhappy Paths

1. **Unknown route.** Visiting a route that does not exist (e.g. `/unknown`) results in Next.js 404 behaviour. No custom 404 page required for this brief; default is acceptable.
2. **Build failure.** If the build fails, the deliverable is incomplete; Implementer must fix until build passes.

---

## Edge Cases

- **None critical for this brief.** Skeleton has no user input, no external services, no data. Browser refresh and direct URL access to defined routes should work; no special edge-case handling required.

---

## Approach (High-Level Rationale)

1. **Next.js App Router.** Use `app/` as the root of the router. Single root `layout.tsx` that includes any global UI (e.g. minimal header or nothing) and applies global CSS. Child routes for customer area (e.g. `/` or `/cardapio`) and employee area (e.g. `/admin` or `/pedidos`) as separate route segments; each can have its own `layout.tsx` later if needed — for skeleton, one level is enough.
2. **Tailwind.** Initialize Tailwind per Next.js + Tailwind docs. Use Tailwind classes on placeholder pages to confirm configuration (e.g. typography, spacing, one responsive touch if trivial).
3. **shadcn/ui.** Install per shadcn docs (e.g. `npx shadcn@latest init`). Add one component (e.g. Button or Card) to a placeholder page so the setup is verified and future features can add more.
4. **Portuguese.** All visible strings (headings, placeholders, button labels) in Portuguese. No translation layer; static strings in components or a single constants file are fine.
5. **Vitest.** Add Vitest and a minimal config; one passing test (e.g. `expect(true).toBe(true)` or a tiny `lib` helper test) so the pipeline is in place for Stage 2 on future features.
6. **No Supabase, no env.** Do not add Supabase client or environment variables in this brief. Skeleton must run with no external services.

Route naming convention to lock: use Portuguese-friendly paths that match PROJECT.md intent — e.g. `/` or `/cardapio` for customers, `/admin` or `/pedidos` for employees. Pick one and document in Decisions below.

---

## Decisions (Locked)

- **Customer route:** Use `/` as the customer-facing entry (home = menu/cardápio placeholder). Alternative: `/cardapio` as home; either is acceptable — Implementer chooses one and keeps it consistent.
- **Employee route:** Use `/admin` for the employee/owner area (placeholder for "orders dashboard" later). Clear separation from public `/`.
- **Single root layout.** One `app/layout.tsx` for the whole app in this brief; nested layouts for `/admin` can be added in a later feature if needed.
- **Portuguese only.** No multi-locale; all UI copy in pt-BR.
- **No auth in skeleton.** Employee area is reachable without login; auth will be added in a separate feature brief.

---

## Stage 0 Exit Gate

- Problem is clearly defined
- Goals are concrete and testable
- Non-goals are explicitly listed
- Happy and unhappy paths are documented
- Edge cases are surfaced
- Key decisions are locked
- Approach is outlined at a high level (no code)
- Critic has approved this brief

