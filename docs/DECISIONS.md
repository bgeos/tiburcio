# Decisions

Deviations from `docs/PLAN.md` and other architectural choices. Newest last.

## D-001 · 2026-11-11 · Own Supabase project instead of a database on jupigenio's server
Plan rule 2.3 asks for the same DB server as jupigenio, with a separate database and DB user.
jupigenio runs on Supabase, where one project is one Postgres database with its own Auth and
Storage, so the Supabase equivalent is a separate project.
- Project `tiburcio`, ref `quincosoqtgzgjucsidg`, region eu-north-1 (same as jupigenio
  staging), same Supabase org, free plan.
- `supabase/config.toml` is copied from jupigenio (same auth defaults, public sign-up off),
  with local ports moved to 544xx so both stacks can run side by side, and without
  jupigenio's invitation email template.
- It is the only database: jupigenio's tables move into it as a module (D-003).
- Hosted auth settings don't travel with migrations: sign-up must be turned off in the
  dashboard by hand, as jupigenio does (its D-032).

## D-002 · 2026-11-11 · Tibúrcio is independent; jupigenio is only a tab with a frame
**Superseded by D-003 the same day.**
Bruno's decision: treat Tibúrcio as a new project that will grow big. This replaces plan §7.
- jupigenio gets no changes (no proxy, HMAC auth mode, base path or summary endpoint).
- The jupigenio tab shows `JUPIGENIO_URL` (default `https://jupigenio.vercel.app`) in a
  full-height frame, lazy-loaded, with an "Open in new tab" button. Tibúrcio's CSP allows
  `frame-src` for that origin only.
- Signing in inside the frame works only when both apps are the same site (jupigenio's session
  cookie is `SameSite=Lax`, and `*.vercel.app` is a public suffix), so they need subdomains of
  one custom domain. Until then, the tab says so and points to the new-tab button.
- Tibúrcio doesn't read jupigenio data; the Home jupigenio panel is a shortcut to the tab.
- Because the project will be big, the repo is an npm workspaces monorepo (`apps/web` first),
  and `apps/web` is split by module (DISCOVERY §3).

## D-003 · 2026-11-11 · One single-user app; jupigenio becomes a Tibúrcio module
Bruno's decision: Tibúrcio is a bigger, single-person application, and jupigenio (the first
project) is just one part of it. Replaces plan §7 and D-002.
- Tibúrcio starts from jupigenio's codebase (imported with git history), since it already has
  the Next.js 16 shell, Supabase login, RLS, tests and CI that plan Phase 1 asks for.
- jupigenio's features live under `/jupigenio/…` as the `jupigenio` module. Multi-user parts
  are removed: invitations, roles, team page, accept-invite and no-organization flows.
- One account (Bruno), sign-up off, created by `npm run user:create`.
- One Supabase project, `tiburcio`; jupigenio's migrations are re-applied there. Its staging
  data is test data only, so nothing is migrated.
- Code is split by module under `src/modules/<name>`; one Next.js app at the repo root until a
  second app (photo helper) needs npm workspaces.
- Afterwards the `jupigenio` repo is archived (not deleted), its Vercel app switched off or
  redirected, and its Supabase project deleted only after Bruno confirms.

## D-004 · 2026-11-11 · jupigenio keeps workspaces, one per job
Bruno's decision (answers DISCOVERY Q2). Inside Tibúrcio are the personal things (projects,
chat, photos…). When a job comes in, e.g. a festival, Bruno opens the jupigenio tab and works
in that job's own workspace, separate from the personal side.
- jupigenio's organizations stay, shown as **workspaces** under `/jupigenio/<workspace>/…`.
  Bruno creates them and is the only member.
- Their data never mixes with personal projects; Home only shows a summary.
- Membership-based RLS stays as it is (with one member it means "only Bruno"); only the
  multi-user parts go (D-003).

## D-005 · 2026-11-11 · How Phase 1 made jupigenio single-user
- jupigenio was merged in with its history; its docs moved to `docs/jupigenio/`.
- Its pages moved from `/<org>/…` to `/jupigenio/<workspace>/…` (`JUPIGENIO_PATH`,
  `workspacePath()` in `lib/navigation.ts`). `/` is Tibúrcio's Home; `/jupigenio` opens the
  first workspace or offers to create one. Signing in lands on Home.
- Removed: invitations (table, functions, pages, actions, tests), the Team page, the
  no-organization and accept-invite pages, and the role check on creating a workspace
  (migration `20261111100000_single_user.sql`).
- **Kept for now:** jupigenio's roles and role-based policies. With one member who is always
  admin they change nothing, and removing them touches most jupigenio pages and tests. Taking
  them out is a later cleanup, not a Phase 1 goal.
- `personal_projects` arrives now (owner-only RLS) so `npm run user:create` can add the six
  projects; its tasks, notes, materials and files follow in Phase 3.
