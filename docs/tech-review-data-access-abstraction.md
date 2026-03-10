# Tech Review + First Data Access Abstraction — Feature Documentation

Summary for the next engineer: what changed, where it lives, what was deferred, and how to operate it safely.

**Brief:** [docs/briefs/tech-review-data-access-abstraction.md](briefs/tech-review-data-access-abstraction.md)

---

## What Was Delivered

- **First admin/orders data-access boundary:** The app now has a narrow domain-specific interface for admin order persistence work instead of relying on raw Supabase order queries directly in every call site.
- **Supabase-backed adapter:** The first concrete implementation remains Supabase-backed; this feature reduces coupling in the app layer without changing providers.
- **First slice migrated:** `/admin`, `GET /api/admin/orders`, and `progressOrderStatus` now use the admin/orders data-access boundary for persistence operations.
- **Auth boundary preserved:** `auth.getUser()` and session validation remain in the page/route/action layer and were intentionally not absorbed into the abstraction.
- **Behavior preserved:** Admin list loading, polling payloads, status progression, stale-update handling, pickup `Pronto para retirada`, and delivery `Saiu para entrega` flows all remain unchanged.
- **Boundary tests added:** The repo now has direct tests for the Supabase admin/orders adapter in addition to the existing call-site behavior tests.
- **Hardening added:** The admin action now fails closed if a conditional status update returns an unexpected persisted row instead of silently accepting a bad success result.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Admin/orders data-access contract | `lib/admin-orders-data-access.ts` |
| Supabase-backed admin/orders adapter | `lib/supabase/admin-orders-data-access.ts` |
| Shared admin order select contract | `lib/admin-orders-query.ts` |
| Admin dashboard page using the abstraction | `app/admin/page.tsx` |
| Admin polling route using the abstraction | `app/api/admin/orders/route.ts` |
| Admin status progression action using the abstraction | `app/admin/actions.ts` |
| Direct adapter tests | `lib/supabase/admin-orders-data-access.test.ts` |
| Admin page boundary tests | `app/admin/page.test.tsx` |
| Admin polling route boundary tests | `app/api/admin/orders/route.test.ts` |
| Admin action behavior tests | `app/admin/actions.test.ts` |

---

## Decisions (Locked)

- **Feature scope:** This is not a repo-wide repository/service rewrite.
- **First abstraction domain:** `admin/orders`.
- **First migrated call sites:** `app/admin/page.tsx`, `app/api/admin/orders/route.ts`, and `app/admin/actions.ts`.
- **Auth/session boundary:** Session validation stays at the route/action/page edge and is not part of the first data-access abstraction.
- **Provider strategy:** Supabase remains the only runtime implementation for now.
- **Abstraction style:** Domain-specific interface, not generic CRUD base classes.
- **Behavior preservation:** No user-facing workflow or schema contract changes were introduced by this feature.

---

## Operational Notes

- **Migration status:** No new migration was introduced by this feature.
- **Current environment assumption:** This abstraction relies on the existing admin/orders schema and status migrations already being applied in the current environment.
- **Failure behavior:** Admin order loads and updates still return the existing pt-BR error messages on failures; the abstraction does not change response shapes.
- **Stale-update behavior:** `progressOrderStatus` still uses conditional update semantics and safe stale reload behavior.
- **Unexpected write-shape guard:** If the conditional update returns an unexpected `id` or `status`, the action logs the anomaly and returns the existing generic failure message instead of accepting the write as success.

Regression checks after future edits:
- Confirm `/admin` still loads via the abstraction and renders as before.
- Confirm `GET /api/admin/orders` still uses the abstraction and returns the same payload shape.
- Confirm `progressOrderStatus` still preserves success, stale, validation, and generic-error behavior.
- Confirm auth/session checks remain outside the abstraction boundary.

---

## Known Gaps & Deferred Work

- **Not a repo-wide abstraction yet:** Customer submission, menu import/runtime, and other Supabase touchpoints are intentionally still outside this first slice.
- **No live DB integration harness:** Adapter tests mock Supabase chain behavior; they validate the boundary contract but not a live integration.
- **Supabase typed-chain workaround remains:** Provider-specific chain casts are now localized in the adapter, but they still exist.
- **No runtime migration-health checks:** This feature does not verify schema/migration state at runtime.
- **No abstraction metrics/tracing:** Operational diagnosis still depends on logs rather than dedicated per-method counters.

---

## For the Next Engineer

- **If you extend this pattern:** Keep the next slice narrow and domain-specific instead of introducing a generic repository framework.
- **If you touch admin auth:** Keep auth/session validation separate from persistence unless a new brief explicitly changes that boundary.
- **If you add new admin/orders persistence operations:** Add them to `lib/admin-orders-data-access.ts` first, then implement them in `lib/supabase/admin-orders-data-access.ts`, then migrate the caller.
- **If you change the admin order payload shape:** Update `lib/admin-orders-query.ts`, the adapter tests, and the page/route tests together so the contract does not drift.
