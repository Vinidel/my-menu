# AI Engineering OS

A structured, multi-agent delivery workflow for AI-assisted software development.

Built and maintained by [Vinícius Deláscio](https://vinidel.github.io/vinidelascio.github.io/).

---

## What This Is

A reusable set of Cursor agent rules, workflow docs, and templates that implement a 6-stage, stage-gated delivery methodology.

Rather than using AI to just write code, this system orchestrates purpose-built agents across clearly defined stages — each with a specific role, permitted actions, and an exit gate reviewed by a dedicated Critic Agent before progression.

The result: AI that moves fast without losing direction.

---

## The Workflow

| Stage | Agent | Responsibility |
|---|---|---|
| 0 | Orchestrator | Brief creation, scope, exit gates |
| 1 | Implementer | Production code, happy + unhappy paths |
| 2 | Tester | Tests derived from brief acceptance scenarios |
| 3 | Refactorer | Structure and clarity — no behaviour changes |
| 4 | Hardener | Security, performance, observability, resilience |
| 5 | Documenter | Decisions, gaps, PR packaging |
| All | **Critic** | Reviews every stage before progression |

Read the full workflow: [workflow/WORKFLOW.md](workflow/WORKFLOW.md)

---

## Repo Structure

```
.cursor/
  rules/              ← Cursor agent definitions (.mdc files)
    critic.mdc
    orchestrator.mdc
    implementer.mdc
    tester.mdc
    refactorer.mdc
    hardener.mdc
    documenter.mdc

workflow/
  WORKFLOW.md         ← Full workflow documentation

templates/
  feature-brief.md    ← Feature brief template (Stage 0)
  pull-request-template.md  ← PR template with stage checklist

examples/             ← Completed briefs and real-world examples (coming soon)
```

---

## How to Use in a New Project

1. Copy `.cursor/rules/` into your project root
2. Copy `templates/` into your project
3. Copy `templates/pull-request-template.md` to `.github/pull_request_template.md`
4. Create a `docs/` folder in your project for briefs, critiques, and notes
5. **Update the Stack-Specific Considerations section** in each `.mdc` file to reflect your project's conventions

That's it. Open Cursor, select an agent, and start with Stage 0.

---

## Core Principle

> AI accelerates execution. Structure preserves direction.

Read more: [Building My Personal Engineering Operating System (With AI)](https://vinidel.github.io/vinidelascio.github.io/personal-engineering-os/)
