# my-menu

A small-scale burger ordering app for a burger place — customers choose items and submit orders; the owner/employees track orders and update their status. UI in Portuguese (Brazil).

---

## What it is

- **Customers:** Page to view the menu (from JSON), select items, enter name/email/phone, and submit an order.
- **Employees:** Login with email and password; screen to list orders and update status (e.g. received, preparing, ready).

Menu is configured via a JSON file. Infrastructure: Supabase (data and auth), Vercel (hosting).

---

## Stack

- **Next.js** (App Router), **Tailwind CSS**, **shadcn/ui**
- **Supabase** (auth and database)
- **Vitest** (tests)
- **Vercel** (deploy)

Details in [PROJECT.md](PROJECT.md).

---

## Getting started

```bash
# Install dependencies
npm install

# Development
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Route `/` is the customer menu; `/admin` is the employee area (login at `/admin/login`). To use the employee area, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.example`).

```bash
# Production build
npm run build

# Tests
npm run test
```

---

## Project structure

```
app/           → Routes and pages (Next.js App Router)
components/    → React components; components/ui/ for shadcn
lib/           → Utilities, Supabase client (when added)
docs/          → Feature briefs, critiques, implementation notes
```

Full layout in [PROJECT.md](PROJECT.md).

---

## Development (workflow)

This repo uses a stage-gated workflow with Cursor agents (Orchestrator, Implementer, Tester, Refactorer, Hardener, Documenter, Critic). Briefs live in `docs/briefs/`; the workflow is in [workflow/WORKFLOW.md](workflow/WORKFLOW.md).

---

## Author

[Vinícius Deláscio](https://vinidel.github.io/vinidelascio.github.io/)
