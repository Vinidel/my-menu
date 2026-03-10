# Provider-Agnostic Data Access and Client Naming Follow-Up — Feature Documentation

Summary for the next engineer: what changed, where it lives, what was deferred, and how to operate it safely.

**Brief:** [docs/briefs/provider-agnostic-data-access-and-client-naming-follow-up.md](briefs/provider-agnostic-data-access-and-client-naming-follow-up.md)

---

## What Was Delivered

- **App-facing client boundary split by environment:** App and component code now uses provider-agnostic entrypoints instead of importing `@/lib/supabase/server`, `@/lib/supabase/client`, or `@/lib/supabase/service-role` directly.
- **Environment-specific modules:** The shared boundary is now split into browser-only, request-only, privileged-only, and paired request+privileged helpers instead of one mixed module.
- **Locked app-layer migration completed:** All app/component files covered by the brief now import provider-agnostic names for this slice.
- **Supabase remains internal:** The new app-facing modules still delegate to the existing Supabase implementations under `lib/supabase/*`.
- **Behavior preserved:** Admin auth, admin polling, admin actions, customer order submission, and menu-import flows keep their existing behavior.
- **Boundary tests updated:** Tests now mock the app-facing modules directly, and the split boundary has direct unit coverage.
- **Hardening added:** The split modules now declare explicit `client-only` / `server-only` fences so mixed-environment import mistakes fail closer to the source.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Browser app-facing client | `lib/browser-client.ts` |
| Request-scoped app-facing client | `lib/request-client.ts` |
| Privileged app-facing client | `lib/privileged-client.ts` |
| Paired request + privileged helper | `lib/request-and-privileged-clients.ts` |
| Browser boundary tests | `lib/browser-client.test.ts` |
| Request boundary tests | `lib/request-client.test.ts` |
| Privileged boundary tests | `lib/privileged-client.test.ts` |
| Paired-helper tests | `lib/request-and-privileged-clients.test.ts` |
| Vitest environment-guard shims | `test/shims/client-only.ts`, `test/shims/server-only.ts` |

Main migrated app/component call sites:

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

---

## Decisions (Locked)

- **Feature scope:** This is not a repo-wide provider rename.
- **App-layer rule:** `app/**` and `components/**` should not import `@/lib/supabase/*` directly for the migrated client/access slice.
- **Provider strategy:** Supabase remains the only runtime implementation for now.
- **Internal allowance:** `lib/**` may still import `lib/supabase/*` internally where needed.
- **Split boundary choice:** Browser, request, and privileged access are separate entrypoints; the paired helper exists only for server-side code that legitimately needs both.
- **Behavior preservation:** No auth, order, or menu-import workflow changes were introduced by this feature.

---

## Operational Notes

- **Migration status:** No DB migration was introduced by this feature.
- **Environment fences:** `lib/browser-client.ts` is `client-only`; `lib/request-client.ts`, `lib/privileged-client.ts`, and `lib/request-and-privileged-clients.ts` are `server-only`.
- **Test-runtime note:** Vitest resolves `client-only` and `server-only` through local no-op shims in `test/shims/` so unit tests can load the boundary modules without weakening the Next.js runtime guard.
- **Why the split matters:** A previous mixed boundary allowed browser code to pull in a request-scoped module transitively, surfacing as a `next/headers` build error. The split entrypoints and environment fences are the guardrail against that regression class.

Regression checks after future edits:

- Confirm new app/component files do not import `@/lib/supabase/server`, `@/lib/supabase/client`, or `@/lib/supabase/service-role` directly for this slice.
- Confirm browser code only imports `lib/browser-client.ts`.
- Confirm server code uses `lib/request-client.ts`, `lib/privileged-client.ts`, or `lib/request-and-privileged-clients.ts` deliberately.
- Confirm `npm run build` still passes after any boundary edits; that is the fastest check for mixed-environment drift.

---

## Known Gaps & Deferred Work

- **Not a repo-wide decoupling yet:** Provider-specific naming still exists in internal library modules and in deferred slices outside this feature.
- **Generated DB types remain provider-named:** `lib/supabase/database.types.ts` stays as-is in this pass.
- **No live integration coverage:** Boundary tests validate delegation and import structure via mocks, not a live provider/client-construction integration.
- **No lint rule yet:** The app-layer rule is documented and test/build-checked, but there is no dedicated lint rule preventing future direct `@/lib/supabase/*` imports in `app/**` or `components/**`.

---

## For the Next Engineer

- **If you migrate another slice:** Keep the same rule: app-facing modules should use provider-agnostic names, and provider-specific modules should stay internal.
- **If you need both request and privileged access:** Use `lib/request-and-privileged-clients.ts` only in server code and only when both clients are genuinely required.
- **If you touch tests:** Keep mocking the app-facing boundary, not the provider-specific module, in app/component tests for migrated slices.
- **If you extend the rule repo-wide later:** Lock the next slice explicitly in a new brief instead of broadening this feature in place.
