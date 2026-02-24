---
# Critique

Date: 2026-02-24
Reviewed by: Critic Agent
Scope: Stage 1 implementation review (second pass) — Customer Order Submission (`/`, `/api/orders`, customer/order migrations)
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- `app/page.tsx:6` still checks only public Supabase env vars to show submission as available. Since `/api/orders` depends on `SUPABASE_SERVICE_ROLE_KEY`, consider surfacing a server-computed `isOrderSubmissionConfigured` flag that includes the service-role key to avoid a submit-time `503` surprise.
- `components/customer-order-page.tsx` uses two tab systems (`Cardápio/Seu pedido` and category tabs). Consider adding `aria-controls` and panel ids for stronger accessibility/testability in Stage 2/4.

### Risks / Assumptions
- The new hardening migration correctly removes public `customers` reads and direct public `orders` inserts, but it must be applied in Supabase to take effect (`supabase/migrations/20260224110000_lock_down_public_order_submission_tables.sql`).
- `/api/orders` now relies on `SUPABASE_SERVICE_ROLE_KEY`; operational environments must keep this secret server-only and never expose it via `NEXT_PUBLIC_*`.
- Rate limiting / bot protection is still deferred and remains a hardening concern for a public order endpoint.

## Acceptance Criteria (Stage 1 spot-check)
- [x] Public `/` menu flow implemented with selection, quantities, and customer form
- [x] Inserts `public.orders` with `status = aguardando_confirmacao`, `customer_id`, and snapshots
- [x] Optional `Observações` maps to `orders.notes`
- [x] `/api/orders` returns proper HTTP status codes (`201/400/500/503`)
- [x] Public table grants/policies aligned with service-role architecture (via hardening migration)
---
