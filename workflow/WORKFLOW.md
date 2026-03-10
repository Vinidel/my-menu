# AI Engineering OS — Workflow

A stage-gated, multi-agent delivery workflow for AI-assisted software development.

Each stage has a dedicated agent with specific responsibilities and a clear exit gate.
The **Critic Agent** reviews the output of every stage before the next one begins.
The **Gate Keeper Agent** runs after each completed stage to keep local/remote branches and the PR in sync.
The PR is updated at each stage, creating a traceable audit trail of feature maturity.
This workflow can also be enforced by an external stage runner.

---

## Core Principle

> AI accelerates execution. Structure preserves direction.

Raw AI speed feels productive. Structured AI collaboration feels sustainable.
This workflow optimises for sustainable throughput, not burst velocity.

---

## Workflow Routing

Before Stage 0 begins, select the workflow depth for the change:
- **Full** — new features, cross-cutting or high-risk work
- **Light** — small bug fixes and low-risk enhancements
- **Hotfix** — urgent production restoration with post-fix catch-up

The selected workflow must be recorded in the brief or scope note before implementation begins.

---

## The Agents

| Agent | Stage | Responsibility |
|---|---|---|
| Orchestrator | 0 | Brief creation, scope definition, exit gates |
| Implementer | 1 | Production code, happy + unhappy paths |
| Tester | 2 | Tests derived from brief acceptance scenarios |
| Hardener | 3 | Structural cleanup plus security, performance, observability, and resilience sweep |
| Documenter | 4 | Decisions, gaps, PR packaging |
| Gate Keeper | All (post-stage) | Keeps commit/push/PR state, labels, and sync flow consistent after each finished stage |
| **Critic** | All | Reviews output of every stage before progression |

---

## The Stages

This document describes the full stage set.
Not every change should use every stage.
Use the router first, then run only the stages required by that workflow.

Each stage should also write a handoff artifact to `.artifacts/<feature>/<stage>/handoff.md`.
This gives Critic and any external runner a stable summary of the stage output.

### Stage 0 — Brief (Orchestrator)

Before any code is written, the Orchestrator creates a Feature Brief in `docs/briefs/`.

Before writing the brief, the Orchestrator records a routing decision:
- Change type
- Workflow selected (`Full`, `Light`, or `Hotfix`)
- Scope
- Risk
- Blast radius
- Urgency
- Required stages
- Skipped stages and why

The brief defines:
- The problem being solved
- Success criteria (concrete and testable)
- Non-goals (explicit scope boundaries)
- Happy and unhappy paths
- Edge cases
- Key decisions (locked)
- High-level approach (no code)

For urgent production recovery, Stage 0 becomes a hotfix scope note in `docs/hotfixes/` with issue, impact, immediate fix, rollback plan, and follow-up work.

**Exit gate:** Critic approves the brief or scope note → Gate Keeper syncs branch/PR state → next required stage begins.

---

### Stage 1 — Implement (Implementer)

The Implementer works strictly within the brief.

- Implements the smallest vertical slice
- Handles happy and unhappy paths
- Adds basic logging
- Logs unrelated issues in `docs/implementation-notes.md` — does not fix them
- Hands off to Gate Keeper to commit/push and open or update the Draft PR with label `stage-1-impl`

**Exit gate:** Critic approves the implementation → Gate Keeper syncs branch/PR state → Tester begins.

---

### Stage 2 — Test (Tester)

The Tester derives all tests from the brief's acceptance scenarios.

- Writes unit, integration, and/or e2e tests as appropriate
- Locks all happy paths, unhappy paths, and edge cases
- CI must pass
- Hands off to Gate Keeper to commit/push and update PR label/status to `stage-2-tests`

**Exit gate:** Critic approves test coverage → Gate Keeper syncs branch/PR state → Hardener begins.

---

### Stage 3 — Harden (Hardener)

The Hardener now combines the old refactor and hardening passes into one stage.

- Improves naming, reduces duplication, and aligns patterns without changing behaviour
- Tests must remain green — a failing test means the structural cleanup is wrong
- Performs a full risk sweep

- Security: input validation, auth, secrets, error leakage
- Dependencies: new packages, known vulnerabilities
- Performance: N+1 queries, timeouts, load behaviour
- Observability: logging, tracing, diagnosability
- Resilience: downstream failures, fallbacks
- Documents unresolved risks in `docs/hardening-notes.md`
- Hands off to Gate Keeper to commit/push and update PR label/status to `stage-3-hardening`

**Exit gate:** Critic approves hardening → Gate Keeper syncs branch/PR state → Documenter begins.

---

### Stage 4 — Document (Documenter)

The Documenter captures everything that matters for the future.

- Documents decisions made and why
- Captures deferred items and known gaps
- Adds operational notes for deployment and on-call
- Adds a short retrospective note when the change exposed useful workflow lessons
- Hands off final documentation artifacts to Gate Keeper for PR packaging and final state updates

**Exit gate:** Critic approves documentation → Gate Keeper syncs final PR state → PR is ready for human review.

---

## Workflow Modes

### Full

Use when:
- new feature or meaningful feature expansion
- touches multiple layers or services
- changes auth, security, billing, data handling, or external integrations
- introduces new dependencies or infrastructure
- affects critical user journeys
- rollback would be costly or risky

Stages:
0. Orchestrator
1. Implementer
2. Tester
3. Hardener
4. Documenter

After each completed stage:
- Critic reviews
- Gate Keeper syncs commit, push, labels, and PR state

With the local auto-loop, that becomes:

```text
run stage
→ validate handoff
→ run Critic
→ if APPROVE: run Gate Keeper
→ else stop and route back
```

### Light

Use when:
- bug fix or small enhancement
- limited blast radius
- no major data model or infrastructure change
- low security and operational risk
- easy to verify locally and in CI

Recommended stage shape:
0. Orchestrator-Lite
1. Implementer
2. Tester
3. Critic
4. Gate Keeper

Notes:
- Stage 0 is still required, but shorter
- Hardener is skipped unless the change touches risk-sensitive areas
- Documenter is optional; Gate Keeper can package the PR using the brief and critique

### Hotfix

Use when:
- production is broken or materially degraded
- customer impact is happening now
- the priority is restoring service quickly

Recommended stage shape:
0. Hotfix Scope Note
1. Implementer
2. Tester-Minimum
3. Hardener-Quick Sweep
4. Gate Keeper
5. Post-Fix Critic + Documenter Catch-Up

Notes:
- the initial note defines the issue, impact, immediate fix, and rollback plan
- implementation should be minimal and reversible
- tests focus on regression protection for the incident path
- hardening is limited to obvious risk checks during recovery
- critique and documentation catch up after stabilisation

---

## Retrospectives

For merged work that produced useful learning, add a lightweight retrospective note in `docs/retrospectives/`.

Use it to capture:
- workflow type selected
- what worked
- what was skipped
- where the workflow prevented rework or defects
- where it added drag
- rework loops or backflow that occurred
- escaped risks or residual concerns
- what should change in the agents or workflow

This is intentionally short.
If there was no meaningful learning, skip it.

---

## Controlled Backflow

Backward movement is allowed when the evidence requires it:
- If scope is unclear, go back to Orchestrator
- If implementation violates the brief, go back to Implementer
- If tests reveal requirement ambiguity, go back to Orchestrator or Implementer based on root cause
- If hardening reveals design-level risk, go back to Implementer and update brief notes
- If documentation reveals unresolved decisions, reopen the relevant stage instead of documenting confusion as fact

Backflow is not failure.
Uncontrolled forward motion is failure.

---

## The PR Lifecycle (with Gate Keeper)

```
Draft
  → stage-1-impl       (Critic approves, then Gate Keeper syncs)
  → stage-2-tests      (Critic approves, then Gate Keeper syncs)
  → stage-3-hardening  (Critic approves, then Gate Keeper syncs)
  → stage-4-review     (Critic approves, then Gate Keeper syncs/finalizes)
  → merge
```

One PR. Multiple maturity states. Full audit trail.

---

## Folder Structure

When dropping this workflow into a new project, copy the following:

```
.cursor/
  rules/
    orchestrator.mdc
    implementer.mdc
    tester.mdc
    hardener.mdc
    documenter.mdc
    critic.mdc

PROJECT.md                    ← Project context (read by every agent before every stage)

docs/
  briefs/               ← Feature briefs (created per feature)
  hotfixes/             ← Hotfix scope notes for emergency changes
  critique.md           ← Critic output (overwritten each review)
  implementation-notes.md  ← Out-of-scope issues spotted during Stage 1
  hardening-notes.md    ← Risks and deferred items from Stage 4
  retrospectives/       ← Lightweight workflow learning notes after merge

.github/
  pull_request_template.md

Auto-loop config:
  .ai-os-stage-loop.local.env   ← Local runner command templates

templates/
  ai-os-stage-loop.env.example  ← Example auto-loop config
  PROJECT.md            ← Project brief template
  feature-brief.md      ← Brief template
  hotfix-scope-note.md  ← Hotfix scope note template
  retrospective.md      ← Lightweight retrospective template
  stage-handoff.md      ← Standard stage handoff template
```

---

## Stack-Specific Setup

When starting a new project, update the **Stack-Specific Considerations** section in each `.mdc` file to reflect:

- Language and framework conventions
- Data layer patterns
- Infrastructure specifics (cloud provider, services used)
- Existing test frameworks and patterns
- Any team conventions that agents should follow

This keeps agents agnostic by default but well-informed per project.
