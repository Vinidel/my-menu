# Critique

Date: 2026-03-09
Reviewed by: Critic Agent
Scope: Stage 5 documentation for pickup-ready admin status flow
Verdict: CHANGES_REQUESTED

## Findings

### Required Changes
1. [docs/] Stage 5 feature doc is missing → Add a dedicated shipped-feature document for the pickup-ready status step, equivalent in scope to `docs/admin-delivery-status-step.md`, covering the new `Pronto para retirada` flow, canonical status, admin ordering, migration dependency, and verification record.
2. [PROJECT.md] Project status/docs index has not been updated for the shipped pickup-ready feature → Add the feature to the delivered-features list and include the new documentation in the docs inventory so repo-level project context stays current.
3. [docs/employee-orders-dashboard.md / docs/order-delivery-option.md or equivalent existing feature docs] Existing admin-flow docs still describe the older state without the new pickup-ready parallel step → Update the relevant existing docs so the documented admin lifecycle matches the current shipped behavior: pickup/legacy uses `Pronto para retirada`, delivery uses `Saiu para entrega`.

### Suggested Improvements
- If the migration has already been applied in the active environment, say that explicitly in the new feature doc while still noting that any new environment must apply `20260309123000_add_ready_for_pickup_status.sql` before or with the matching app deploy.

### Risks / Assumptions
- Current docs create a repo-level mismatch: code, tests, and hardening notes describe the pickup-ready branch, but the primary feature docs and `PROJECT.md` do not, which increases onboarding and rollout confusion.
- This review assumes Stage 5 has not been intentionally skipped; if the team wants to defer standalone feature docs, that process decision should be made explicitly rather than leaving the repo in a partially documented state.

## Acceptance Criteria
- [ ] A dedicated Stage 5 feature doc exists for the pickup-ready admin status step.
- [ ] `PROJECT.md` lists the feature as delivered and includes the new doc in the docs section.
- [ ] Relevant existing admin/order-flow docs reflect the current parallel status model: pickup/legacy `Pronto para retirada`, delivery `Saiu para entrega`.
- [ ] Documentation clearly states the migration dependency for `20260309123000_add_ready_for_pickup_status.sql`.
