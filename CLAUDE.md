@AGENTS.md

# Tibúrcio — instructions for Claude Code

Tibúrcio is Bruno's single-user command center: personal projects, chat with
Claude, photos, calendar and more. **jupigenio** (production projects for
festivals and builds) is one module of it, under `/jupigenio/<workspace>/…`
(D-003, D-004). The plan is `docs/PLAN.md`; where it and `docs/DECISIONS.md`
disagree, DECISIONS wins.

## Start of every session

1. Read `docs/PLAN.md` (phases in § 11), `docs/DECISIONS.md`, and this file.
2. Run `git status` and `git log --oneline -10`.
3. Identify the current phase and its acceptance criteria in `docs/PLAN.md` § 11.
4. `docs/jupigenio/` holds jupigenio's own history (blueprint, roadmap, data model,
   decisions D-001…D-034). Read it before changing the jupigenio module.
5. Read the relevant code, and the matching guide in
   `node_modules/next/dist/docs/` before using any Next.js API (this is
   Next.js 16 — see AGENTS.md above).

## End of every task

1. Run `npm run check` (lint + typecheck + tests), `npm run build`, and
   `npm run test:e2e` when UI or routes changed. Run `npm run test:db` when
   migrations or policies changed (needs `npm run db:start`).
2. Fix failures caused by your changes. Never claim a check passed unless it
   was actually run in this session.
3. Update `docs/DECISIONS.md` for any architectural or product decision.
4. Report: what changed, which checks passed, what remains, exact commands.

## Stack (see docs/DECISIONS.md for rationale)

- Next.js 16 App Router, React 19, TypeScript (strict), `src/` layout, `@/*` alias.
- `cacheComponents: true` is on: request-time reads (`cookies()`, session)
  must sit behind `<Suspense>`; never read cookies inside plain `"use cache"`.
  Every data page needs its own `loading.tsx`/`<Suspense>` (D-017).
- Middleware is called **Proxy** in Next 16: `src/proxy.ts`.
- Tibúrcio's own pages live in `src/app/(app)/` (Home is `/`). jupigenio pages live under
  `src/app/(app)/jupigenio/[org]/` (URL `/jupigenio/<workspace>/<section>`). Link inside a
  workspace with `OrgLink`/`useOrgPath`, or `workspacePath()`; never hand-build `/${org}/…`.
  URL hooks in shared layouts go in `<Suspense>`.
- Single user (D-003): no invitations, team page or sign-up. The account comes from
  `npm run user:create`. jupigenio's roles still exist in the database (Bruno is admin of
  every workspace); don't build UI around them.
- `error.tsx` props are `{ error: unknown, retry }` (not `reset`).
  `unauthorized()`/`forbidden()` are enabled (`authInterrupts`).
- Tailwind CSS 4 + shadcn/ui (Radix, `npx shadcn@4.22.1 add <component>`).
  Use the design tokens in `globals.css`; no hard-coded colours.
- Forms: native `useActionState` + Zod via `parseForm` (D-013). There is no React Hook Form.
- Reuse `src/components/*` (PageHeader, EmptyState, StatTile, StatusBadge,
  DataTable, ConfirmDialog, TextField…) before creating new primitives.
- Status is never colour-only. Missing data is "—", never a fake 0. Demo data
  needs `DemoDataNotice`.
- Supabase: Postgres, Auth, Storage, Row Level Security.
- Vitest for unit tests; Supabase local + SQL tests for RLS; Playwright for
  browser smoke tests (added when the first real flow exists).
- Package manager: **npm only**. Do not add pnpm/yarn lockfiles.

## Non-negotiable rules

- **Security:** every table has RLS enabled with policies in the same migration
  that creates it: workspace tables check `organization_id` membership, personal
  tables check `user_id = auth.uid()`. Authorize on the
  server in every Server Action / Route Handler; hiding UI is not security.
- **Secrets:** never commit `.env*` (except `.env.example`). Never use the
  Supabase service-role key in client code or a `NEXT_PUBLIC_` variable;
  import server-only modules with `import "server-only"`.
- **Money** is `numeric(14,2)` + explicit currency; **quantities** are
  `numeric(14,3)` + unit. Never floats.
- **Stock** changes only through movement records (ledger); never overwrite a
  balance directly.
- **Schema changes** only via migrations in `supabase/migrations/`. Ask before
  destructive or irreversible migrations.
- **No fake data as real metrics.** Demo data must be clearly labelled.
- Archive (soft delete) records that are part of audit history.
- Don't add dependencies without saying why. Keep changes small and reviewable.
- Do not implement later phases early; do not rewrite working code without reason.

## Commands

```
npm run dev        # dev server at http://localhost:3000
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest (single run)
npm run check      # lint + typecheck + test
npm run build      # production build
npm run test:e2e   # Playwright + axe (builds, serves on :3100)
npm run db:start   # local Supabase (Docker)
npm run test:db    # pgTAP RLS tests against local Supabase
npm run user:create -- --email you@example.com --name "Bruno" [--yes]   # the one account + personal projects
```

## Windows gotchas

- Never write files with PowerShell `Set-Content -Encoding utf8`: it adds a BOM, and
  a BOM in `package.json` breaks Turbopack. Use the Write/Edit tools. If it happens,
  strip the BOM and delete `.next/` (Turbopack caches the bad file).
- `example files/` and `examples web ui/` hold the team's real reference data. Read
  them for requirements but never commit them or copy real names into seeds.
