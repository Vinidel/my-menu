---
# Critique

Date: 2026-03-09
Reviewed by: Critic Agent
Scope: Stage 1 implementation for `docs/briefs/admin-delivery-status-step.md`
Verdict: APPROVE

## Findings

### Required Changes
1. None.

### Suggested Improvements
- Add Stage 2 coverage for the new delivery-only branch in `lib/orders`, the `/admin` dashboard progression UI, and the server action stale/error paths so the locked `entrega` vs `retirada` behavior is regression-resistant.
- Add a migration or integration test around the new DB constraint/trigger combination to verify pickup rows cannot persist `saiu_para_entrega` while delivery rows can still advance forward normally.

### Risks / Assumptions
- Approval assumes the new Supabase migration [20260309113000_add_delivery_out_for_delivery_status.sql](/Users/vinny/workspace/personal/my-menu/supabase/migrations/20260309113000_add_delivery_out_for_delivery_status.sql) is applied before rollout; without it, the app and DB status contracts will diverge.
- Approval assumes existing admin polling and stale-update tests are updated in Stage 2 to reflect the new operational order `aguardando_confirmacao -> em_preparo -> saiu_para_entrega -> entregue` for delivery rows.
- Repository-wide `tsc --noEmit` remains blocked by pre-existing test-only typing issues outside this feature; that did not surface a production-code blocker in the reviewed scope, but it still limits verification depth.

## Acceptance Criteria
- [ ] Apply the new Supabase migration in the target environment before deploying the app changes.
- [ ] Verify manually that delivery orders advance `Em preparo -> Saiu para entrega -> Entregue` in `/admin`.
- [ ] Verify manually that pickup orders still advance `Em preparo -> Entregue` and never enter `Saiu para entrega`.
- [ ] Verify manually that the `/admin` summary shows a dedicated `Saiu para entrega` card and that status-first ordering matches the locked sequence.
- [ ] Add Stage 2 tests covering the new delivery-only status branch and DB/API rejection behavior for invalid pickup transitions.
---
