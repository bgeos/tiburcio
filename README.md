# Tibúrcio

Bruno's single-user command center: personal projects, chat with Claude, photos,
calendar and integrations, with **jupigenio** (production projects for festivals and
builds: subprojects, cronograma, dependencies, Gantt, materials) as one of its modules.

> **Status:** Phase 1 (base from jupigenio, single user). See [`docs/PLAN.md`](docs/PLAN.md)
> § 11 for the phases and [`docs/DECISIONS.md`](docs/DECISIONS.md) for what changed from the plan.

## Documentation

| File | Purpose |
| --- | --- |
| [`docs/PLAN.md`](docs/PLAN.md) | Build plan and phases |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisions; they win over the plan |
| [`docs/DISCOVERY.md`](docs/DISCOVERY.md) | Phase 0: what jupigenio was made of, and the stack chosen |
| [`docs/design/homepage.dc.html`](docs/design/homepage.dc.html) | Home (Command Center) design |
| [`docs/jupigenio/`](docs/jupigenio/) | jupigenio's own blueprint, architecture, data model and decisions |
| [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) | Instructions for coding agents |

## Requirements

- Node.js 20.9+ (CI uses Node 24) and npm. **Use npm only**.
- Docker Desktop, running, for the local Supabase stack (database and browser tests).
  The Supabase CLI is a dev dependency (`npx supabase …` or the `npm run db:*` scripts).

## Setup

```bash
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev                  # http://localhost:3000
```

`.env.local` points either at the hosted project or at a local stack. Never commit it.

### Hosted database

The Supabase project is `tiburcio` (ref `quincosoqtgzgjucsidg`, eu-north-1, D-001); the repo
is linked to it. New migrations: `npx supabase db push --dry-run`, then `npx supabase db push`.
Auth settings live in the dashboard (they don't travel with migrations): public sign-up off,
Site URL and redirect URLs set to the app's address.

Create the one account (asks for the password, adds the six personal projects):

```bash
npm run user:create -- --email you@example.com --name "Bruno" --yes
```

### Local database

```bash
npm run db:start    # first run downloads the Docker images (several minutes)
npm run db:env      # writes .env.local from the running stack
```

| URL | What |
| --- | --- |
| http://127.0.0.1:54421 | Supabase API |
| http://127.0.0.1:54423 | Studio (database browser) |
| http://127.0.0.1:54424 | Mailpit: catches auth emails sent locally |

Ports are 544xx so this stack can run next to an old jupigenio one (543xx).
`npm run db:reset` rebuilds the database from `supabase/migrations/` and `supabase/seed.sql`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | Regenerate route types, then TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run check` | Lint + typecheck + unit tests |
| `npm run test:e2e` | Browser + accessibility tests (Playwright) on port 3100. Needs `db:start` |
| `npm run test:db` | Database security tests (pgTAP). Needs `db:start` |
| `npm run db:start` / `db:stop` / `db:status` / `db:reset` / `db:env` | Local Supabase stack |
| `npm run user:create -- --email … [--name …] [--yes]` | Create the one account and its personal projects. Refuses non-local targets without `--yes` |
| `npm run org:create -- --name … --slug … --admin email [--yes]` | Create a jupigenio workspace for an existing user (also possible in the app) |

First time only, install the test browser: `npx playwright install chromium`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests: lint, typecheck,
unit tests, production build and a scan of the browser bundle for secrets; then a throwaway local
Supabase inside the runner for the database (pgTAP) and browser (Playwright) tests.
No hosted project or secret is needed.
