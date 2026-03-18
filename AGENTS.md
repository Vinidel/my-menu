# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a **Next.js 14** burger ordering app ("Lanchonete Dioney") — a monolithic app with customer menu/ordering and admin dashboard. All UI is in Portuguese (pt-BR). See `README.md` and `PROJECT.md` for full context.

### Running the app

- **Dev server:** `npm run dev` (port 3000)
- **Lint:** `npm run lint`
- **Tests:** `npm run test` (Vitest, all mocked — no external services needed)
- **Build:** `npm run build`

### Environment setup

- Copy `.env.example` to `.env.local` for local development.
- Set `ORDERS_CAPTCHA_ENABLED=false` to disable Turnstile CAPTCHA in dev.
- Supabase credentials are required for admin auth and order persistence, but the customer menu (`/`) loads from `data/menu.json` and works without Supabase.

### Key caveats

- The `.eslintrc.json` file must exist for `npm run lint` to run non-interactively. If missing, `next lint` prompts for interactive configuration. The file should contain `{"extends": "next/core-web-vitals"}`.
- Tests use jsdom and all external services (Supabase, OpenAI, Turnstile) are mocked — no network access needed.
- The admin area (`/admin`) requires real Supabase credentials for auth. Without them, admin routes will show errors but the customer menu still works.
