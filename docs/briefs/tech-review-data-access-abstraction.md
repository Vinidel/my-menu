# Feature Brief — Tech Review + First Data Access Abstraction

Status: Stage 0 — Framing
Date: 2026-03-09
Author: Orchestrator Agent

---

## Alternative Name

Data access boundary for orders / First repository layer / Reduce direct Supabase coupling

---

## Problem

The codebase currently mixes application logic with direct Supabase query calls across multiple areas:

- customer order submission (`app/actions.ts`, `app/api/orders/route.ts`)
- admin order load/update paths (`app/admin/page.tsx`, `app/api/admin/orders/route.ts`, `app/admin/actions.ts`)
- admin auth/session checks
- menu import/runtime flows

This creates three related problems:

1. **Data access is not structured consistently.** Query logic, business rules, parsing, and route/action concerns are often in the same file.
2. **The app is tightly coupled to Supabase as an implementation detail.** Reusing logic, testing behavior independently of Supabase chains, or swapping data providers later is harder than it should be.
3. **A repo-wide abstraction rewrite would be too risky right now.** The codebase is still small, but several features are already shipped. A large architectural rewrite would create churn without enough confidence.

The next step should not be “abstract everything.” It should be a scoped technical review that produces one clear boundary and migrates the highest-value path first.

---

## Goal

Define and implement a **small first data-access abstraction** for the orders/admin domain so application code depends on an interface boundary instead of raw Supabase query chains in the most important flow.

Success = we document the current structure, lock the target boundary, introduce an interface-backed implementation for the first slice, and migrate the selected path without changing shipped behavior.

---

## Who

- **Developers:** Need clearer structure, easier reasoning, and less provider-specific leakage across routes/actions.
- **Future maintainers:** Need a pattern they can extend incrementally instead of copying raw Supabase access into more files.
- **Operators/product owners:** Need architectural improvement without destabilizing shipped order flows.

---

## What Changes

- **Architecture review artifact:** Document the current Supabase touchpoints and the chosen first abstraction boundary.
- **First interface boundary:** Introduce a data-access interface for the selected order/admin slice.
- **Concrete adapter:** Provide a Supabase-backed implementation of that interface.
- **Call-site migration:** Move the chosen first slice off direct Supabase query chains and onto the interface.
- **Structure clarification:** Separate business logic from persistence concerns more clearly for that slice.

---

## Recommended Scope (Locked)

This feature is intentionally **not** a repo-wide repository layer.

### In Scope

- Review current data access shape in:
  - admin orders read path
  - admin order status progression path
  - shared order-loading/query helpers tied to those paths
- Introduce a first interface for the **orders/admin domain**.
- Migrate the first slice to that interface.
- Keep the abstraction narrow and practical.
- Keep admin auth/session validation in the route-action layer for this feature; do not absorb `auth.getUser()` into the first data-access boundary.

### Out of Scope

- Replacing all Supabase usage in one feature.
- Abstracting auth/login/logout in this pass.
- Abstracting menu import worker/runtime in this pass.
- Abstracting every customer-order path in this pass.
- Changing database schema or shipped business behavior.
- Introducing dependency injection framework complexity.

---

## First Slice (Locked)

The first migrated slice is:

- **admin orders listing/loading**
- **admin order status progression**

Why this slice:

- it is central to daily operations
- it already has shared status rules and tests
- it has duplicated and typed-cast-heavy Supabase access patterns
- it benefits immediately from cleaner boundaries without requiring a broad rewrite

Customer submission and menu-import paths are explicitly deferred to later follow-ups.

---

## Success Criteria

- [ ] A short architecture review is captured in the implementation/documentation output for this feature.
- [ ] The repo has a clear interface for the first orders/admin data-access slice.
- [ ] The first interface is implemented by a Supabase-backed adapter.
- [ ] The first interface boundary is limited to admin/orders persistence operations; admin session validation remains outside that boundary in the route/action layer.
- [ ] Admin orders page loading no longer performs raw Supabase order queries directly in the page/route layer for the selected slice.
- [ ] Admin order status progression no longer embeds raw Supabase order lookup/update chains directly in the action layer for the selected slice.
- [ ] Business behavior remains unchanged:
  - pickup/legacy `Em preparo -> Pronto para retirada -> Entregue`
  - delivery `Em preparo -> Saiu para entrega -> Entregue`
- [ ] Existing tests continue to pass, and new tests cover the abstraction boundary where appropriate.
- [ ] The new structure is incremental and does not require migrating unrelated Supabase touchpoints in this feature.

---

## Non-Goals (Out of Scope)

- Full repository/service architecture across the whole app.
- Removing Supabase from the project.
- Supporting multiple database providers in production now.
- Generalizing every table behind one generic CRUD abstraction.
- Rewriting all server actions/routes to use a DI container.
- Changing auth middleware structure in this feature.

---

## Acceptance Scenarios

### Happy Paths

1. **Admin page load uses abstraction.** `/admin` loads orders through the new orders/admin data-access boundary and renders exactly as before.
2. **Admin polling route uses shared abstraction.** `GET /api/admin/orders` uses the same boundary or shared underlying abstraction contract and returns the same payload shape as before.
3. **Admin status progression uses abstraction.** `progressOrderStatus` performs lookup/update behavior through the new boundary and still returns the same success/stale/error outcomes.
4. **Auth stays outside the boundary.** Route/action code still performs session validation directly, then calls the orders/admin abstraction only for persistence work.
5. **Supabase-backed adapter remains the concrete implementation.** The app still uses Supabase in production, but application-layer code is less directly coupled to it.

### Unhappy Paths

1. **Lookup fails.** Admin load/update paths still return the same safe pt-BR error behavior when the adapter reports query failure.
2. **Stale update race occurs.** The abstraction preserves conditional-update behavior and stale reload semantics.
3. **Auth boundary drifts.** Implementation does not pull admin session validation into the new abstraction in this feature.
4. **Migration scope expands accidentally.** Feature implementation stops after the first slice instead of trying to absorb unrelated Supabase areas.

---

## Edge Cases

- Avoid creating an abstraction so generic that it hides domain rules instead of clarifying them.
- Avoid duplicating old query code under a new filename without improving boundaries.
- Keep order parsing/status logic separate from raw persistence calls where useful, but do not split so aggressively that the flow becomes harder to follow.
- Preserve current route/action payloads and user-visible pt-BR messages.
- Keep testability practical: use small interfaces, not framework-heavy indirection.
- Avoid silently turning the feature into a “request context” or “backend service container” abstraction by pulling auth/session handling into the same boundary.

---

## Approach (High-Level Rationale)

1. **Map current touchpoints.** Identify where the orders/admin slice currently talks to Supabase directly.
2. **Choose one boundary.** Introduce an orders/admin data-access interface with only the methods needed by the selected slice.
3. **Keep domain-specific naming.** Prefer names like `OrdersAdminDataAccess` or equivalent over generic `Repository<T>` patterns.
4. **Add one Supabase adapter.** Move the raw Supabase query logic behind that adapter.
5. **Keep auth at the edge.** Route/action layers continue owning session validation and authorization checks.
6. **Migrate call sites.** Update `/admin` load, polling route, and status progression action to use the interface for persistence work only.
7. **Leave other domains alone.** Document deferred follow-ups for customer submission, menu import, and auth rather than rewriting them now.

---

## Decisions (Locked)

- **Feature combines todo 4 and todo 7:** technical structure review plus a first interface-backed implementation.
- **Implementation strategy:** incremental migration, not repo-wide rewrite.
- **First abstraction domain (locked):** admin/orders.
- **First call sites (locked):**
  - `app/admin/page.tsx`
  - `app/api/admin/orders/route.ts`
  - `app/admin/actions.ts`
- **Auth/session boundary (locked):** `auth.getUser()` and other session validation stay in the route/action layer for this feature and are not part of the first data-access abstraction.
- **Provider strategy:** keep Supabase as the only concrete runtime implementation for now.
- **Abstraction style:** domain-specific interface, not generic CRUD base classes.
- **Behavior preservation:** no user-facing workflow or DB-contract changes in this feature.
- **Deferred domains:** customer order submission, auth, menu import/runtime.
- **Language:** all user-facing messages remain pt-BR; architecture/docs may remain English as existing repo conventions allow.

---

## Follow-Up Candidates (Document, Don’t Implement Here)

- Extend the abstraction pattern to customer order submission.
- Extend the abstraction pattern to menu import/runtime flows.
- Revisit auth/session access shape separately from data-access abstraction.
- Consider a broader services/repositories layout only after 1-2 successful incremental migrations.

---

## Stage 0 Exit Gate

- [x] Problem is clearly defined
- [x] Goal is concrete and testable
- [x] Scope is explicitly narrowed
- [x] First slice is locked
- [x] Happy/unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] High-level approach is outlined
- [ ] Critic has approved this brief
