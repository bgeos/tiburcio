@AGENTS.md

# JupiGenio — instructions for Claude Code

JupiGenio is a production/project management platform for festivals, events,
construction, scenic design and workshops. The product brief and phased plan
live in `PROJECT_BLUEPRINT.md`; it is the source of truth for scope.

## Start of every session

1. Read `PROJECT_BLUEPRINT.md`, this file, and `docs/ROADMAP.md`.
2. Run `git status` and `git log --oneline -10`.
3. Identify the current phase and its acceptance criteria in `docs/ROADMAP.md`.
4. Pick the next item(s) from `docs/BACKLOG.md`; plan only the current task.
5. Read the relevant code, and the matching guide in
   `node_modules/next/dist/docs/` before using any Next.js API (this is
   Next.js 16 — see AGENTS.md above).

## End of every task

1. Run `npm run check` (lint + typecheck + tests), `npm run build`, and
   `npm run test:e2e` when UI or routes changed.
2. Fix failures caused by your changes. Never claim a check passed unless it
   was actually run in this session.
3. Update `docs/ROADMAP.md` / `docs/BACKLOG.md` status, and
   `docs/DECISIONS.md` for any architectural or product decision.
4. Report: what changed, which checks passed, what remains, exact commands.

## Stack (see docs/DECISIONS.md for rationale)

- Next.js 16 App Router, React 19, TypeScript (strict), `src/` layout, `@/*` alias.
- `cacheComponents: true` is on: request-time reads (`cookies()`, session)
  must sit behind `<Suspense>`; never read cookies inside plain `"use cache"`.
  Every data page needs its own `loading.tsx`/`<Suspense>` (D-017).
- Middleware is called **Proxy** in Next 16: `src/proxy.ts`.
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

- **Security:** every org-owned table has `organization_id` and RLS enabled
  with policies in the same migration that creates the table. Authorize on the
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
```

## Windows gotchas

- Never write files with PowerShell `Set-Content -Encoding utf8`: it adds a BOM, and
  a BOM in `package.json` breaks Turbopack. Use the Write/Edit tools. If it happens,
  strip the BOM and delete `.next/` (Turbopack caches the bad file).
- `example files/` and `examples web ui/` hold the team's real reference data. Read
  them for requirements but never commit them or copy real names into seeds.
