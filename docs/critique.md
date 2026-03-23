---
# Critique

Date: 2026-03-23
Reviewed by: Critic Agent
Scope: Stage 4 documentation package — `docs/admin-order-editing.md`
Verdict: APPROVE

## Findings

### Required Changes

None.

### Suggested Improvements

- Optional UX improvement could be elevated from “Known Gaps” into a concrete follow-up task for maintainers (e.g. explicitly show “Remova/substitua estes itens” when server rejects unknown menu items).

### Risks / Assumptions

- Runtime menu parity relies on reading active `menu_versions` using service-role credentials (`getRuntimeMenuItems`). If those env vars or DB access are misconfigured in an environment, both `/` and `/admin` may fall back to `data/menu.json`, potentially reintroducing “unknown item” experiences. This is acknowledged in the doc’s rollout notes.

## Acceptance Criteria

- [x] Documentation covers delivered behavior, locked decisions, operational contract, setup/rollout notes, testing, deferred work, and operator safety notes.
- [x] The document reflects the Stage 3 hardening decision: strict legacy/unknown handling in `AdminOrderEditSheet` (no name-based fallback in `initialLines`).
- [x] Menu parity dependency between `/` and `/admin` is clearly documented.
- [x] `npm test` coverage and key test focus areas are mentioned.
---
