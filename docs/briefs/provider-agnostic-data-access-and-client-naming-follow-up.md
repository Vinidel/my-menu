# Feature Brief — Provider-Agnostic Data Access and Client Naming Follow-Up

Status: Stage 0 — Framing
Date: 2026-03-10
Author: Orchestrator Agent

---

## Alternative Name

Remove provider naming from app layers / Provider-agnostic app imports / Supabase naming containment follow-up

---

## Problem

The first `admin/orders` abstraction reduced direct query-chain coupling, but the repo still exposes provider naming across app-layer files:

- routes/pages/actions still import modules from `@/lib/supabase/...`
- app-layer code still calls provider-named factories such as `createClient()` and `createServiceRoleClient()`
- some newer abstractions still mention Supabase at the construction boundary instead of hiding it completely behind a provider-agnostic entrypoint

That creates a structural mismatch:

1. **The app layer still knows too much about the provider.** Even when the logic is decoupled, import paths and constructor names still advertise Supabase as the runtime dependency.
2. **Abstraction intent is inconsistent.** Some slices now have a provider-agnostic contract, while neighboring app-layer files still couple to provider-specific module names.
3. **A repo-wide rename would be too risky.** There are many remaining Supabase touchpoints across auth, service-role operations, menu import, and customer submission. Doing all of them in one pass would create churn and review risk.

The follow-up should keep the same incremental strategy as the previous brief: remove provider naming from the app layer in one locked slice, while keeping the provider-specific implementation internal.

---

## Goal

Define and implement the next narrow step in provider decoupling so **app-layer files stop mentioning Supabase for the selected slice**, while runtime behavior and provider choice remain unchanged.

Success = selected routes/pages/actions import provider-agnostic modules and factories, Supabase-specific implementation stays behind internal boundaries, and the rollout does not turn into a repo-wide rename.

---

## Who

- **Developers:** Need app-layer code to speak in domain/app terms instead of provider terms.
- **Future maintainers:** Need a repeatable pattern for hiding provider specifics behind stable entrypoints.
- **Reviewers/operators:** Need a scoped structural improvement that does not destabilize shipped flows.

---

## What Changes

- **Follow-up architecture cleanup:** Pick the next slice where provider-specific names still leak into the app layer.
- **Provider-agnostic app entrypoints:** Introduce or reuse non-provider-named modules/factories for that slice.
- **Call-site migration:** Update the chosen app-layer files to import only provider-agnostic names for that slice.
- **Provider containment:** Keep Supabase-specific naming internal to `lib/supabase/*` or equivalent implementation modules.
- **Documentation update:** Record the new boundary and the remaining deferred Supabase-named areas.

---

## Recommended Scope (Locked)

This feature is intentionally **not** a repo-wide provider rename.

### In Scope

- Continue from the first `admin/orders` abstraction work.
- Remove provider-specific naming from app-layer imports for the selected next slice.
- Allow provider-specific naming to remain in internal implementation modules.
- Keep behavior unchanged.
- Keep migration incremental and test-backed.

### Out of Scope

- Renaming every `lib/supabase/*` module in one pass.
- Swapping Supabase out as the real provider.
- Rewriting all DB types away from `lib/supabase/database.types.ts` in this feature.
- Reworking every existing customer/admin/menu-import path at once.
- Introducing DI containers or framework-heavy provider registries.

---

## Next Slice (Locked)

The next slice is:

- **shared auth/client access used directly by app-layer files**
- specifically, app-layer imports of:
  - `@/lib/supabase/server`
  - `@/lib/supabase/client`
  - `@/lib/supabase/service-role`

Why this slice:

- it is the most obvious remaining provider naming leak in the app layer
- it affects multiple routes/pages/actions already in active use
- it can improve consistency without changing business behavior
- it sets the pattern for later slices such as customer submission and menu import/runtime

### Current Migration Set (Locked)

This feature must migrate **all current `app/**` and `components/**` imports** of the selected module families at the time this brief was written.

Locked current implementation set:

- `components/admin-logout-button.tsx`
- `app/actions.ts`
- `app/api/orders/route.ts`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/actions.ts`
- `app/api/admin/orders/route.ts`
- `app/admin/login/page.tsx`
- `app/admin/cardapio/page.tsx`
- `app/admin/cardapio/actions.ts`
- `app/api/admin/menu-import/process-next/route.ts`
- tests covering those areas, including:
  - `app/admin/actions.test.ts`
  - `app/admin/page.test.tsx`
  - `app/admin/layout.test.tsx`
  - `app/api/admin/orders/route.test.ts`
  - `app/api/orders/route.test.ts`
  - `app/admin/login/page.test.tsx`
  - `app/admin/cardapio/page.test.tsx`
  - `app/admin/cardapio/actions.test.ts`
  - `app/api/admin/menu-import/process-next/route.test.ts`

If new app/component imports of `@/lib/supabase/server`, `@/lib/supabase/client`, or `@/lib/supabase/service-role` are introduced after this brief, they are out of scope unless explicitly added during implementation review.

---

## Scope Rule (Locked)

For this follow-up, “app layer” means:

- `app/**`
- `components/**`

The hard rule for the selected slice:

- app-layer files must not import from `@/lib/supabase/*` directly for the migrated constructors/boundaries

Allowed after this feature:

- provider-specific modules may still exist under `lib/supabase/*`
- `lib/**` internal implementation modules may still import from `lib/supabase/*` where needed
- generated DB types may remain in `lib/supabase/database.types.ts` for now

---

## Success Criteria

- [ ] The locked current implementation set no longer imports provider-specific modules for the migrated client/access boundary.
- [ ] The repo has provider-agnostic app-facing entrypoints for the selected slice.
- [ ] Supabase remains the concrete runtime implementation behind those entrypoints.
- [ ] Existing admin/customer/menu-import behavior remains unchanged.
- [ ] Existing tests continue to pass, and new tests cover the renamed boundary where appropriate.
- [ ] The brief explicitly documents what remains deferred so this feature does not expand into a repo-wide rename.

---

## Non-Goals (Out of Scope)

- Removing the word “Supabase” from every file in the repository.
- Changing DB schema, RLS, auth behavior, or order workflows.
- Moving generated database types to a new provider-neutral location in this pass.
- Replacing Supabase Auth or service-role usage with a different implementation.
- Refactoring all internal library modules to hide provider naming immediately.

---

## Acceptance Scenarios

### Happy Paths

1. **Locked app-layer call sites stop importing provider-named client modules.** The migrated files use provider-agnostic app-facing factories or access helpers.
2. **Customer/menu-import app-layer call sites included in the locked set migrate too.** They keep current behavior while importing provider-agnostic names.
3. **Provider remains internal.** The new app-facing entrypoints delegate to Supabase-backed implementations under internal modules.
4. **Tests reflect the new boundary.** App-layer tests mock provider-agnostic entrypoints instead of provider-specific ones where the slice is migrated.

### Unhappy Paths

1. **Scope drifts into repo-wide renaming.** Implementation must stop after the locked slice.
2. **Provider name disappears only cosmetically.** The feature should not just rename imports if it leaves app-facing modules semantically provider-bound in the same place without clearer boundaries.
3. **Behavior regresses.** Auth/session checks, order loading, and service-role workflows must keep their current results/messages.

---

## Edge Cases

- Avoid doing a broad rename that only shuffles files without improving the app-layer boundary.
- Avoid mixing two patterns in the same slice unless the distinction is deliberate and documented.
- Keep generated DB types where they are for now; relocating them is a separate concern.
- Be explicit about whether new provider-agnostic names are app-facing only or global. For this feature, they are app-facing first.
- Avoid turning this into a hidden provider abstraction framework; small focused entrypoints are enough.

---

## Approach (High-Level Rationale)

1. **Identify the app-facing provider leaks.** Map which `app/**` and `components/**` files still import `@/lib/supabase/*`.
2. **Choose provider-agnostic entrypoints.** Create stable app-facing modules/functions with non-provider names.
3. **Delegate internally.** Keep Supabase-specific implementation behind those new entrypoints.
4. **Migrate the selected app-layer call sites.** Replace direct provider-named imports with the new app-facing names.
5. **Update tests.** Mock the provider-agnostic boundary in app-layer tests.
6. **Document remaining leaks.** Leave internal/provider modules and deferred slices explicit rather than pretending the repo is fully decoupled.

---

## Decisions (Locked)

- **This is a follow-up to the first `admin/orders` abstraction feature.**
- **Implementation strategy:** incremental slice migration, not repo-wide rename.
- **Primary scope:** remove provider naming from app-layer imports for shared client/access entrypoints.
- **Implementation set:** migrate the full locked current app/component call-site list above, not an arbitrary subset and not future files added later.
- **Provider strategy:** Supabase remains the only runtime implementation for now.
- **App-layer rule:** `app/**` and `components/**` should not import `@/lib/supabase/*` for the migrated slice after this feature.
- **Internal implementation allowance:** `lib/**` may still depend on `lib/supabase/*` where appropriate.
- **DB types decision:** `lib/supabase/database.types.ts` stays where it is in this feature.
- **Behavior preservation:** no auth/order/menu-import workflow changes in this feature.

---

## Follow-Up Candidates (Document, Don’t Implement Here)

- Move provider naming out of remaining internal library modules where it still leaks into domain modules.
- Revisit whether `database.types.ts` should move behind a provider-neutral type boundary.
- Apply the same app-layer rule to customer submission and menu import/runtime in later slices if not fully covered here.
- Consider a broader provider-boundary review only after 1-2 more successful incremental migrations.

---

## Stage 0 Exit Gate

- [x] Problem is clearly defined
- [x] Goal is concrete and testable
- [x] Scope is explicitly narrowed
- [x] Next slice is locked
- [x] Happy/unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] High-level approach is outlined
- [ ] Critic has approved this brief
