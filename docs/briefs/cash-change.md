# Feature Brief — Placeholder de Troco em Observações

Status: Stage 0 — Brief Complete (pending Critic)
Date: 2026-03-10
Author: Orchestrator Agent
Workflow: Full

---

## Workflow Routing Decision

Change type: enhancement
Workflow selected: Full
Reason:
- Scope: Small UI-copy change in the public checkout flow.
- Risk: Low implementation risk and low product blast radius; process risk is primarily around preserving the explicitly requested `Full` stage sequence without expanding the feature beyond placeholder copy.
- Blast radius: Customer checkout only, specifically the `Observações` textarea placeholder on `/`.
- Urgency: Normal.
- Required stages:
  - Orchestrator
  - Implementer
  - Tester
  - Hardener
  - Documenter
- Skipped stages and why:
  - None. The product request in `docs/requests/cash-change.md` is a narrow enhancement that would normally fit `Light`, but this run is explicitly pinned to `Full` by the operator instruction in this session: `Act as the orchestrator agent. Feature slug: cash-change. Workflow: full.` The workflow-state artifact at `.artifacts/cash-change/workflow-state.json` records that routing decision for this run on 2026-03-10.

---

## Alternative Name

Troco no placeholder de observações / Exemplo de troco no campo `Observações`

---

## Problem

The checkout form already exposes an optional `Observações` text area, but its placeholder examples only cover customization notes such as ingredient removal or cooking preference.

For customers paying with cash, asking for change (`troco`) is also a common order note. Without that cue in the placeholder, the field does not clearly signal that cash-change requests can be written there.

---

## Goal

Update the `Observações` placeholder so it explicitly includes a cash-change example (`troco`) alongside the existing examples.

Success = customers see `troco` represented in the placeholder guidance, the field remains optional free text, and no new data field, validation rule, or payment behavior is introduced.

---

## Who

- **Customers (public users):** Get clearer guidance that `Observações` can be used to request cash change.
- **Employees (burger owner/staff):** Continue receiving cash-change instructions through the existing notes field without any admin workflow changes.
- **Developers/operators:** Need scope locked to placeholder copy only so this does not turn into a structured troco feature.

---

## What We Capture / Change

- **Customer checkout UI (`/`):**
  - Update the `Observações (opcional)` textarea placeholder in `components/customer-order-page.tsx`.
  - Preserve the current optional free-text field behavior.
- **No payload/schema changes:**
  - Order submission payload remains unchanged.
  - No new database columns or structured order attributes are introduced.
- **No admin UI changes:**
  - Existing notes rendering in `/admin` remains unchanged.

---

## Success Criteria

- [ ] The `Observações (opcional)` textarea placeholder includes a `troco` example in pt-BR.
- [ ] The placeholder still reads naturally as a list of example notes for the same field.
- [ ] The field remains optional and accepts arbitrary notes as before.
- [ ] Order submission payload, validation, and persistence behavior remain unchanged.
- [ ] No new `troco` input, structured `troco` field, or conditional payment-method logic is introduced.
- [ ] All user-facing text remains Portuguese (pt-BR).

---

## Non-Goals (Out of Scope)

- Adding a dedicated `troco para quanto` input or any structured cash-change UI.
- Making `troco` conditional on `Dinheiro`.
- Persisting `troco` as a separate order field.
- Changing validation, payment-method rules, or admin order details layout.
- Updating placeholder text in unrelated forms or admin screens.

---

## Acceptance Scenarios

### Happy Paths

1. **Customer sees troco guidance.** On `/`, the `Observações (opcional)` field shows placeholder text that includes `troco` as one of the example notes.
2. **Customer can still type any note.** Customer enters free text into `Observações`, including or excluding any troco request, and the field behaves exactly as before.
3. **Existing order submission still works.** Customer submits an order with or without `Observações`; the order flow behaves the same aside from the updated placeholder copy.

### Unhappy Paths

1. **No structured troco flow is implied.** The feature must not introduce new required fields, conditional prompts, or server expectations around troco.
2. **No regression in notes entry.** Updating the placeholder must not clear typed notes, break textarea behavior, or affect submit validation.
3. **No locale drift.** Placeholder text must remain pt-BR and must not introduce English or mixed-language copy.

---

## Edge Cases

- On the supported mobile checkout layout, the longer placeholder must not introduce horizontal overflow; the textarea should stay within the form width and keep its existing wrapping behavior.
- The placeholder should not imply that only troco/customization notes are allowed; it remains example text.
- Existing saved orders and `/admin` notes display do not need migration because placeholder copy does not affect persisted data.

---

## Approach (High-Level Rationale)

1. Update the existing textarea placeholder copy in the customer checkout component.
2. Keep the change strictly presentational: no submit-contract, server, or database updates.
3. Add regression coverage around the rendered placeholder text in the customer-order UI tests so future copy refactors do not silently remove the troco guidance.
4. During hardening/documentation, confirm the wording does not over-promise a structured troco feature and note that future real troco support should be handled as a separate feature.

---

## Decisions (Locked)

- **Feature scope is locked to placeholder text only.**
- **`Troco` is guidance text, not structured data.**
- **No behavior change:** order submission, validation, payload shape, and persistence remain unchanged.
- **UI surface:** only the customer checkout `Observações (opcional)` textarea placeholder on `/`.
- **Language:** placeholder copy remains pt-BR.
- **Future troco workflow:** any dedicated `troco para quanto` field or cash-only logic requires a separate brief.

---

## Security / Operational Constraints

- No auth or data-handling changes are expected because this feature is presentational only.
- The implementation must avoid accidental scope creep into server validation or persistence.
- Tests should verify the intended UI copy without coupling to unrelated implementation details.

---

## Stage 0 Exit Gate

- [x] Workflow routing decision is explicit and justified
- [x] Problem is clearly defined
- [x] Goals are concrete and testable
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] Major security and operational constraints are surfaced when relevant
- [x] Approach is outlined at a high level (no code)
- [ ] Critic has approved this brief
