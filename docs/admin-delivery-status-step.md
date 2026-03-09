# Admin Delivery Status Step — Feature Documentation

Summary for the next engineer: what changed, where it lives, what was deferred, and how to operate it safely.

**Brief:** [docs/briefs/admin-delivery-status-step.md](briefs/admin-delivery-status-step.md)

---

## What Was Delivered

- **New admin delivery-only status:** Delivery orders can now enter `Saiu para entrega` before `Entregue`.
- **Locked canonical persisted value:** The new persisted status is `saiu_para_entrega`.
- **Delivery-aware progression:** `/admin` now progresses delivery orders as `Esperando confirmação -> Em preparo -> Saiu para entrega -> Entregue`.
- **Pickup flow preserved:** Pickup orders still progress as `Esperando confirmação -> Em preparo -> Entregue`.
- **Status-first ordering updated:** Admin summary cards and dashboard list ordering now include `Saiu para entrega` in the locked operational position before `Entregue`.
- **Summary visibility updated:** `/admin` shows a dedicated top summary card for `Saiu para entrega`.
- **Safe legacy fallback preserved:** Unknown statuses still render safely, and rows with missing/unknown `fulfillment_type` are not forced into the delivery-only branch.
- **DB integrity enforced:** The database now allows `saiu_para_entrega`, rejects it for non-delivery rows, and enforces the forward-only delivery/pickup transition rules.

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
| Supabase migration for delivery-only status | `supabase/migrations/20260309113000_add_delivery_out_for_delivery_status.sql` |
| Supabase DB types | `lib/supabase/database.types.ts` |
| Tests (dashboard UI) | `components/admin-orders-dashboard.test.tsx` |
| Tests (server action) | `app/admin/actions.test.ts` |
| Tests (shared order helpers) | `lib/orders.test.ts` |
| Tests (admin page / polling route query shape) | `app/admin/page.test.tsx`, `app/api/admin/orders/route.test.ts` |

---

## Decisions (Locked)

- **New pt-BR status label:** `Saiu para entrega`.
- **New canonical persisted status:** `saiu_para_entrega`.
- **Delivery-only progression:** `aguardando_confirmacao -> em_preparo -> saiu_para_entrega -> entregue`.
- **Pickup progression:** `aguardando_confirmacao -> em_preparo -> entregue`.
- **Applicability rule:** Only `fulfillment_type = 'entrega'` may enter `saiu_para_entrega`.
- **Unknown fulfillment fallback:** Missing/unknown fulfillment must not be treated as delivery for progression purposes.
- **Admin summary scope:** `/admin` includes a dedicated `Saiu para entrega` summary card.
- **Operational ordering:** `Esperando confirmação -> Em preparo -> Saiu para entrega -> Entregue`.
- **Language:** All employee-facing labels and messages remain pt-BR.

---

## Operational Notes

- **Migration status:** `supabase/migrations/20260309113000_add_delivery_out_for_delivery_status.sql` has been applied.
- **Rollout dependency still matters in new environments:** Any future environment must apply the delivery-status migration before or with the matching app deploy.
- **DB contract:** The migration updates both the allowed status set and the transition enforcement function. App code and DB rules must stay aligned.
- **Safe stale handling:** The admin status-update action uses conditional update semantics and returns a deterministic stale response when another employee updates first.
- **Logs available for diagnosis:** Admin status progression logs load failures, update failures, stale rejections, and stale follow-up lookup failures without logging customer PII.

Regression checks after future edits:
- Confirm delivery `Em preparo -> Saiu para entrega -> Entregue`.
- Confirm pickup `Em preparo -> Entregue`.
- Confirm `/admin` summary includes `Saiu para entrega`.
- Confirm unknown status rows still render without crashing.

---

## Known Gaps & Deferred Work

- **No customer-facing tracking:** Customers still do not see order progress.
- **No driver/dispatch model:** The app does not assign couriers or store delivery execution details.
- **No automated migration-health check:** Deployment sequencing is still operationally manual.
- **No DB integration-test harness:** DB trigger/constraint behavior is covered indirectly via app-layer tests and documented migration rules, not via live migration tests.
- **Supabase typed-chain workaround remains:** `app/admin/actions.ts` still uses narrow cast helpers for query-chain typing.

---

## For the Next Engineer

- **If you change statuses again:** Update `lib/orders.ts`, the delivery-status migration contract, `app/admin/actions.ts`, `components/admin-orders-dashboard.tsx`, and the related tests together.
- **If you add more admin order loaders:** Reuse `lib/admin-orders-query.ts` so page and polling payloads do not drift.
- **If you extend fulfillment logic:** Keep `fulfillment_type` and lifecycle status as separate concerns. Delivery intent and delivery progress are related but not the same field.
