# Cash Change Placeholder (`Observações`) — Feature Documentation

Summary for the next engineer: what was built, where it lives, what was deferred, and what not to accidentally expand.

**Brief:** [docs/briefs/cash-change.md](briefs/cash-change.md)

---

## What Was Delivered

- **Customer checkout placeholder update (`/`):** The `Observações (opcional)` textarea now explicitly includes the pt-BR cash-change example `troco para R$ 50`.
- **Scope stayed presentational only:** The field remains optional free text with no new dedicated `troco` input, no conditional UI, and no admin-surface changes.
- **Locked payload behavior:** Customer submissions still send cash-change requests only as part of the existing `notes` string when the customer types them.
- **Regression coverage added:** Tests now lock both the rendered placeholder copy and the absence of any structured cash-change payload field.
- **Stage 3 hardening outcome:** Review confirmed no production hardening change was warranted because the shipped change is already the minimum safe implementation.

---

## Where It Lives

| Area | Path / component |
|------|-------------------|
| Customer checkout placeholder | `components/customer-order-page.tsx` |
| Customer UI regression tests | `components/customer-order-page.test.tsx` |
| Stage 3 hardening record | `docs/hardening-notes.md` |
| Workflow artifacts | `.artifacts/cash-change/` |

---

## Decisions (Locked)

- **Feature scope:** Placeholder text only.
- **UI surface:** Only the customer checkout `Observações (opcional)` textarea on `/`.
- **Cash-change contract:** `troco` remains plain free text inside `notes`; it is not structured order data.
- **No behavior change:** Submission, validation, API contract, persistence, and admin rendering remain unchanged.
- **Language:** Placeholder copy stays in pt-BR.
- **Future expansion rule:** Any real `troco para quanto` workflow requires a separate brief and implementation.

---

## Known Gaps & Deferred Work

- **No structured cash-change support:** There is still no dedicated `troco` field, amount parsing, validation, or payment-method-specific flow.
- **No visual regression coverage:** Mobile wrapping/overflow remains covered indirectly by existing component structure rather than a viewport-specific harness.
- **No admin-specific cue:** Employees continue reading any cash-change request from the existing order notes only.

---

## Operational Notes

- **No migration required:** This feature does not change schema, payload shape, or persistence.
- **Regression checks:**
  - confirm the placeholder includes `troco para R$ 50`
  - submit an order with a free-text note containing `troco`
  - confirm the request still uses only `notes` and no dedicated cash-change field
- **Rollback shape:** Reverting this feature is a single placeholder-copy change in `components/customer-order-page.tsx`.

---

## For the Next Engineer

- If product wants `troco para quanto`, treat it as a new feature; it introduces conditional UI, validation, and likely persistence decisions.
- Do not infer any server contract from the placeholder example alone; current behavior is intentionally just guidance text.
- If you revisit mobile copy, keep the textarea examples broad enough that customers still understand `Observações` is general-purpose, not cash-only.
