# Feature Brief — [Feature Name]

Status: Stage 0 — Framing
Date: YYYY-MM-DD
Author: Orchestrator Agent
Workflow: Full | Light

---

## Workflow Routing Decision
Change type: <feature | bugfix | enhancement | refactor | spike>
Workflow selected: <Full | Light>
Reason:
- Scope:
- Risk:
- Blast radius:
- Urgency:
- Required stages:
- Skipped stages and why:

---

## Alternative Name
<!-- Optional. Clarify terminology to prevent naming drift. -->

---

## Problem
<!-- Define the real issue being solved. -->
<!-- What is the gap in current behaviour? Why does this need to change? -->
<!-- Do not describe the solution here. -->

---

## Goal
<!-- What does success look like? -->
<!-- Must be concrete and testable. If you cannot verify it, it is not a goal. -->

---

## Who
<!-- Which user types or systems are affected by this change? -->
<!-- List all segments — missing one here means missed edge cases later. -->

---

## What We Capture / Change
<!-- Data-level changes: new fields, updated fields, storage implications. -->
<!-- Helps Stage 1 and Stage 2 understand scope precisely. -->

---

## Success Criteria
<!-- Written as checkboxes. These become the basis for Stage 2 tests. -->
- [ ] ...
- [ ] ...

---

## Non-Goals (Out of Scope)
<!-- Explicitly state what is NOT included. -->
<!-- This is one of the most important sections — it prevents scope creep. -->
- ...

---

## Acceptance Scenarios

### Happy Paths
<!-- Primary successful user flows. -->
1. ...

### Unhappy Paths
<!-- Validation failures, API failures, edge behaviours, retry logic. -->
1. ...

---

## Edge Cases
<!-- Unusual but realistic conditions: timezones, null fields, legacy users, etc. -->
- ...

---

## Approach (High-Level Rationale)
<!-- Outline implementation strategy at a high level. No code. -->
<!-- Describe DB changes, routing logic, flow positioning, UI intent. -->
<!-- This prevents architectural drift in Stage 1. -->

---

## Decisions (Locked)
<!-- Freeze important product or architecture decisions. -->
<!-- If a decision changes, this section must be updated before Stage 1 continues. -->
- ...

---

## Security / Operational Constraints
<!-- Capture constraints that should shape implementation before Stage 3. -->
<!-- Examples: auth boundaries, validation requirements, idempotency, observability, timeouts -->
- ...

---

## Stage 0 Exit Gate
- [ ] Workflow routing decision is explicit and justified
- [ ] Problem is clearly defined
- [ ] Goals are concrete and testable
- [ ] Non-goals are explicitly listed
- [ ] Happy and unhappy paths are documented
- [ ] Edge cases are surfaced
- [ ] Key decisions are locked
- [ ] Major security and operational constraints are surfaced when relevant
- [ ] Approach is outlined at a high level (no code)
- [ ] Critic has approved this brief
