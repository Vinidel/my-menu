# AI Engineering OS — Workflow

A stage-gated, multi-agent delivery workflow for AI-assisted software development.

Each stage has a dedicated agent with specific responsibilities and a clear exit gate.
The **Critic Agent** reviews the output of every stage before the next one begins.
The PR is updated at each stage, creating a traceable audit trail of feature maturity.

---

## Core Principle

> AI accelerates execution. Structure preserves direction.

Raw AI speed feels productive. Structured AI collaboration feels sustainable.
This workflow optimises for sustainable throughput, not burst velocity.

---

## The Agents

| Agent | Stage | Responsibility |
|---|---|---|
| Orchestrator | 0 | Brief creation, scope definition, exit gates |
| Implementer | 1 | Production code, happy + unhappy paths |
| Tester | 2 | Tests derived from brief acceptance scenarios |
| Refactorer | 3 | Structure, clarity, consistency — no behaviour changes |
| Hardener | 4 | Security, performance, observability, resilience |
| Documenter | 5 | Decisions, gaps, PR packaging |
| **Critic** | All | Reviews output of every stage before progression |

---

## The Stages

### Stage 0 — Brief (Orchestrator)

Before any code is written, the Orchestrator creates a Feature Brief in `docs/briefs/`.

The brief defines:
- The problem being solved
- Success criteria (concrete and testable)
- Non-goals (explicit scope boundaries)
- Happy and unhappy paths
- Edge cases
- Key decisions (locked)
- High-level approach (no code)

**Exit gate:** Critic approves the brief → Implementer begins.

---

### Stage 1 — Implement (Implementer)

The Implementer works strictly within the brief.

- Implements the smallest vertical slice
- Handles happy and unhappy paths
- Adds basic logging
- Logs unrelated issues in `docs/implementation-notes.md` — does not fix them
- Opens the PR as Draft with label `stage-1-impl`

**Exit gate:** Critic approves the implementation → Tester begins.

---

### Stage 2 — Test (Tester)

The Tester derives all tests from the brief's acceptance scenarios.

- Writes unit, integration, and/or e2e tests as appropriate
- Locks all happy paths, unhappy paths, and edge cases
- CI must pass
- Updates PR label to `stage-2-tests`

**Exit gate:** Critic approves test coverage → Refactorer begins.

---

### Stage 3 — Refactor (Refactorer)

The Refactorer improves structure without changing behaviour.

- Improves naming, reduces duplication, aligns patterns
- Tests must remain green — a failing test means the refactor is wrong
- No new features, no bug fixes outside scope
- Updates PR label to `stage-3-refactor`

**Exit gate:** Critic approves refactor → Hardener begins.

---

### Stage 4 — Harden (Hardener)

The Hardener performs a full risk sweep.

- Security: input validation, auth, secrets, error leakage
- Dependencies: new packages, known vulnerabilities
- Performance: N+1 queries, timeouts, load behaviour
- Observability: logging, tracing, diagnosability
- Resilience: downstream failures, fallbacks
- Documents unresolved risks in `docs/hardening-notes.md`
- Updates PR label to `stage-4-hardening`

**Exit gate:** Critic approves hardening → Documenter begins.

---

### Stage 5 — Document (Documenter)

The Documenter captures everything that matters for the future.

- Documents decisions made and why
- Captures deferred items and known gaps
- Adds operational notes for deployment and on-call
- Updates the PR description with summary, brief link, risks, and rollback plan
- Moves PR label to `ready-for-review`

**Exit gate:** Critic approves documentation → PR is ready for human review.

---

## The PR Lifecycle

```
Draft
  → stage-1-impl       (Critic approves)
  → stage-2-tests      (Critic approves)
  → stage-3-refactor   (Critic approves)
  → stage-4-hardening  (Critic approves)
  → ready-for-review   (Critic approves)
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
    refactorer.mdc
    hardener.mdc
    documenter.mdc
    critic.mdc

PROJECT.md                    ← Project context (read by every agent before every stage)

docs/
  briefs/               ← Feature briefs (created per feature)
  critique.md           ← Critic output (overwritten each review)
  implementation-notes.md  ← Out-of-scope issues spotted during Stage 1
  hardening-notes.md    ← Risks and deferred items from Stage 4

.github/
  pull_request_template.md

templates/
  PROJECT.md            ← Project brief template
  feature-brief.md      ← Brief template
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
