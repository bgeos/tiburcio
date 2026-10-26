# JupiGenio

Production and project management for festivals, events, construction,
scenic design, decoration and workshops: nested projects, tasks, schedules,
materials/stock, budgets and dashboards, all operated from the web UI.

> **Status:** Phase 1 complete. The app shell, navigation, design system and
> page states are built. There is no sign-in or data yet (Phase 2). See
> [`docs/ROADMAP.md`](docs/ROADMAP.md). The internal component reference is at
> `/design`.

## Documentation

| File | Purpose |
| --- | --- |
| [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md) | Product brief and phased plan (source of truth) |
| [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) | Instructions for coding agents |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, security model, code layout |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Database schema and calculation rules |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phases, acceptance criteria, progress |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | Small implementation tasks with acceptance criteria |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture/product decisions and open questions |

## Requirements

- Node.js 20.9+ (developed on Node 24) and npm. **Use npm only**; don't mix in pnpm or yarn.
- Git.
- Docker Desktop, running, for the local Supabase stack. The Supabase CLI is a
  dev dependency (`npx supabase …` or the `npm run db:*` scripts).

## Setup

```bash
git clone <repo-url> jupigenio
cd jupigenio
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000.

`.env.local` is not needed until Phase 2 (Supabase). Never commit it.

### Local database (Supabase)

```bash
npm run db:start    # first run downloads the Docker images (several minutes)
npm run db:status   # prints the local URL and keys
```

Copy the **API URL** and the **publishable key** from `db:status` into `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), and the **secret key**
into `SUPABASE_SECRET_KEY`. The local keys only work against your own machine.

| URL | What |
| --- | --- |
| http://127.0.0.1:54321 | Supabase API |
| http://127.0.0.1:54323 | Studio (database browser) |
| http://127.0.0.1:54324 | Mailpit: catches all auth emails sent locally |

`npm run db:reset` rebuilds the database from `supabase/migrations/` and
`supabase/seed.sql`. `npm run db:stop` stops the containers (data is kept).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Regenerate route types, then TypeScript check |
| `npm test` | Unit tests (Vitest, single run) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | Browser + accessibility tests (Playwright). Builds the app and serves it on port 3100 |
| `npm run check` | Lint + typecheck + unit tests |
| `npm run db:start` / `db:stop` / `db:status` | Start, stop, or show the local Supabase stack |
| `npm run db:reset` | Recreate the local database from migrations + seed |
| `npm run test:db` | Database security tests (pgTAP): org isolation and role limits. Needs `db:start` |

First time only, install the test browser: `npx playwright install chromium`.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript ·
Tailwind CSS 4 · shadcn/ui (Radix) · next-themes · Zod · Vitest · Playwright + axe.
Planned: Supabase (Postgres, Auth, Storage, RLS) in Phase 2, Recharts in Phase 6.
See [`docs/DECISIONS.md`](docs/DECISIONS.md).

Reference spreadsheets and screenshots from the team go in `example files/` and
`examples web ui/`. Both are git-ignored because they contain real names and budgets.

## Environments

- **Local:** `npm run dev` plus local Supabase (`npx supabase start`) with seed data.
- **Preview/staging:** Vercel preview deployments plus a separate Supabase project. No real data.
- **Production:** Vercel plus its own Supabase project. Secrets are set in the hosting dashboards only.

Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#environments-and-deployment).
