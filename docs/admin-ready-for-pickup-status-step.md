# Admin Ready-for-Pickup Status Step — Feature Documentation

Summary for the next engineer: what changed, where it lives, what was deferred, and how to operate it safely.

**Brief:** [docs/briefs/admin-ready-for-pickup-status-step.md](briefs/admin-ready-for-pickup-status-step.md)

---

## What Was Delivered

- **New admin pickup-only status:** Pickup and legacy/unknown-fulfillment orders can now enter `Pronto para retirada` before `Entregue`.
- **Locked canonical persisted value:** The new persisted status is `pronto_para_retirada`.
- **Pickup-aware progression:** `/admin` now progresses pickup and legacy/unknown-fulfillment orders as `Esperando confirmação -> Em preparo -> Pronto para retirada -> Entregue`.
- **Delivery flow preserved:** Delivery orders continue as `Esperando confirmação -> Em preparo -> Saiu para entrega -> Entregue`.
- **Status-first ordering updated:** Admin summary cards and dashboard list ordering now use the locked operational order `Esperando confirmação -> Em preparo -> Pronto para retirada -> Saiu para entrega -> Entregue`.
- **Summary visibility updated:** `/admin` shows a dedicated top summary card for `Pronto para retirada`.
- **Safe legacy fallback preserved:** Unknown statuses still render safely, and rows with missing/unknown `fulfillment_type` are treated as pickup flow rather than delivery flow.
- **DB integrity enforced:** The database now allows `pronto_para_retirada`, rejects it for delivery rows, and enforces the forward-only pickup/delivery branching rules.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Admin dashboard page | `app/admin/page.tsx` |
| Admin dashboard UI (summary/list/details/progression) | `components/admin-orders-dashboard.tsx` |
| Status progression server action | `app/admin/actions.ts` |
| Shared order status labels / ordering / progression helpers | `lib/orders.ts` |
| Shared admin order select contract | `lib/admin-orders-query.ts` |
| Admin polling route | `app/api/admin/orders/route.ts` |
| Supabase migration for pickup-ready status | `supabase/migrations/20260309123000_add_ready_for_pickup_status.sql` |
| Supabase DB types | `lib/supabase/database.types.ts` |
| Tests (dashboard UI) | `components/admin-orders-dashboard.test.tsx` |
| Tests (server action) | `app/admin/actions.test.ts` |
| Tests (shared order helpers) | `lib/orders.test.ts` |

---

## Decisions (Locked)

- **New pt-BR status label:** `Pronto para retirada`.
- **New canonical persisted status:** `pronto_para_retirada`.
- **Pickup progression:** `aguardando_confirmacao -> em_preparo -> pronto_para_retirada -> entregue`.
- **Delivery progression:** `aguardando_confirmacao -> em_preparo -> saiu_para_entrega -> entregue`.
- **Applicability rule:** Only non-delivery rows may enter `pronto_para_retirada`.
- **Unknown fulfillment fallback:** Missing/unknown fulfillment is treated as pickup flow and must never be treated as delivery flow.
- **Admin summary scope:** `/admin` includes a dedicated `Pronto para retirada` summary card.
- **Operational ordering:** `Esperando confirmação -> Em preparo -> Pronto para retirada -> Saiu para entrega -> Entregue`.
- **Language:** All employee-facing labels and messages remain pt-BR.

---

## Operational Notes

- **Migration status:** `supabase/migrations/20260309123000_add_ready_for_pickup_status.sql` has been applied in the current environment.
- **Migration dependency in new environments:** `supabase/migrations/20260309123000_add_ready_for_pickup_status.sql` must be applied before or with the matching app deploy in any environment that uses this feature.
- **DB contract:** The migration updates the allowed status set, adds a pickup-only applicability constraint, and updates the transition enforcement function. App code and DB rules must stay aligned.
- **Safe stale handling:** The admin status-update action uses conditional update semantics and returns a deterministic stale response when another employee updates first.
- **Logs available for diagnosis:** Admin status progression logs load failures, update failures, stale rejections, stale follow-up lookup failures, and missing-row stale misses without logging customer PII.

Regression checks after future edits:
- Confirm pickup `Em preparo -> Pronto para retirada -> Entregue`.
- Confirm delivery `Em preparo -> Saiu para entrega -> Entregue`.
- Confirm `/admin` summary includes `Pronto para retirada`.
- Confirm legacy/unknown fulfillment rows never enter `Saiu para entrega`.

---

## Known Gaps & Deferred Work

- **No customer-facing pickup-ready tracking:** Customers still do not see order progress.
- **No automated migration-health check:** Deployment sequencing is still operationally manual.
- **No DB integration-test harness:** DB trigger/constraint behavior is covered indirectly via app-layer tests and documented migration rules, not via live migration tests.
- **Supabase typed-chain workaround remains:** `app/admin/actions.ts` still uses narrow cast helpers for query-chain typing.

---

## For the Next Engineer

- **If you change statuses again:** Update `lib/orders.ts`, the pickup-ready migration contract, `app/admin/actions.ts`, `components/admin-orders-dashboard.tsx`, and the related tests together.
- **If you extend fulfillment logic:** Keep `fulfillment_type` and lifecycle status as separate concerns. Pickup/delivery intent and order-progress lifecycle are related but not the same field.
- **If you add more admin order loaders:** Reuse `lib/admin-orders-query.ts` so page and polling payloads do not drift.
