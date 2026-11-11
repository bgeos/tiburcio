# Discovery: jupigenio (Phase 0)

Read on 2026-11-11 from `bgeos/jupigenio` at `46bc0b1` (main). Sources: `CLAUDE.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (D-001 … D-034), `package.json`,
`next.config.ts`, `src/proxy.ts`, `src/lib/supabase/*`, `src/lib/dal/auth.ts`,
`supabase/config.toml`, `supabase/migrations/*`, `.github/workflows/ci.yml`.

Status: **waiting for Bruno's review.** Nothing below is built yet.

---

## 1. What jupigenio is made of

| Topic | Finding |
|---|---|
| Stack | One full-stack **Next.js 16.4** app (App Router, React 19.3, TypeScript strict, `src/` layout, `@/*` alias). Not a monorepo. Package manager **npm only**. CI uses Node 24. |
| Next.js specifics | `cacheComponents: true` (request-time reads such as cookies must sit behind `<Suspense>`), `partialPrefetching`, experimental `authInterrupts` (`unauthorized()` / `forbidden()`). Middleware is `src/proxy.ts` (Next 16 name). `AGENTS.md` warns that Next 16 APIs differ from older versions: read `node_modules/next/dist/docs/` first. |
| Database | **Supabase** (Postgres 17). Local: `supabase start` (Docker), CLI pinned at `2.120.0`. Staging: hosted project `vuhifzervwszejqdpbnb`, eu-north-1. Production will be its own project (D-032). |
| Schema / migrations | SQL migrations in `supabase/migrations/` with **RLS policies in the same migration as each table**. Helper functions in a `private` schema (`security definer`, empty `search_path`). pgTAP tests in `supabase/tests/`. `seed.sql` holds local demo data only. |
| Data access | Server Components read via a **DAL** (`src/lib/dal/*`). Mutations are **Server Actions** with Zod (`parseForm`) and `useActionState`. Supabase is called **as the signed-in user**, so RLS is the main authorization boundary (D-003). The secret-key admin client is used for one thing only: sending invitations. |
| Auth | **Supabase Auth**, email + password, sessions in cookies via `@supabase/ssr`. `proxy.ts` refreshes the session and does optimistic redirects only. Identity comes from `auth.getClaims()` (verified JWT). Public sign-up off, invitation-only (D-021). `profiles` row per `auth.users` row, created by a trigger. |
| Tenancy / routing | Multi-tenant: `organizations` + `organization_members` (roles admin, production_manager, member, external). Every section lives at `/<org>/<section>` (D-023). No base path support. |
| API | **No REST API.** The only Route Handler is `auth/confirm`. Projects are read through the DAL in Server Components; nothing lists projects over HTTP today. |
| Projects table | `projects(id, organization_id, name, description, status planning/active/finished, sort_order, archived_at, created_by, created_at, updated_at)`, plus `subprojects`, `tasks`, `milestones`, `activity_log`. |
| UI | Tailwind CSS 4 + **shadcn/ui** (Radix, `radix-nova` style), `lucide-react` icons, `next-themes`, `sonner` toasts. Tokens in `src/app/globals.css` (oklch, accent hue switchable per user via `data-accent`). Fonts through `next/font` (Geist, self-hosted at build). Shared components: PageHeader, EmptyState, StatTile, StatusBadge, DataTable, ConfirmDialog, form fields. |
| Rules worth copying | Status never colour-only; missing data is "—", never a fake 0; demo data must carry `DemoDataNotice`; money `numeric(14,2)` + currency, quantities `numeric(14,3)` + unit; soft delete with `archived_at`. |
| Hosting | **Vercel** (Hobby plan), deploys on every push to `main`. Public address `https://jupigenio.vercel.app`. No custom domain yet. Auth settings for hosted projects are set by hand in the Supabase dashboard (D-032). |
| Tests and quality | `npm run check` = ESLint 9 + `next typegen && tsc --noEmit` + Vitest. `npm run test:db` = pgTAP on local Supabase. `npm run test:e2e` = Playwright against `next build && next start` on port 3100, desktop 1440×900 and Pixel 7, with axe WCAG 2.1 AA checks. GitHub Actions runs all of it on PRs; it also greps the client bundle for secret-looking strings. |
| Dev machine note | D-032: the laptop can't run Docker, the dev server and browser tests at the same time, so day-to-day testing uses hosted staging. |

## 2. Where the plan changes

**A. jupigenio becomes a module of Tibúrcio (Bruno, 2026-11-11, D-003).**
Tibúrcio is one single-user application. jupigenio was the first project; its features
(production projects, subprojects, cronograma/tasks, dependencies, Gantt, materials,
milestones, calendar) move **into** Tibúrcio as the `jupigenio` module under `/jupigenio/…`.
The plan's proxy, HMAC header login, base path and iframe are all dropped: they solved
problems that only exist with two apps. Because both are the same stack (Next.js 16,
Supabase, shadcn/ui), the code moves over with little rewriting.

What has to change in that code:
- **Single user.** Invitations, roles (admin / production manager / member / external),
  the team page and `no-organization` / `accept-invite` flows are removed.
- **Organizations.** jupigenio scopes everything by `organization_id` and `/<org>/` URLs.
  For one person this is either kept as "workspaces" (e.g. one per festival, D-033) or
  flattened. See open question 2. Either way, RLS becomes "the owner is `auth.uid()`".
- **Look.** jupigenio's light/dark oklch theme is replaced by Tibúrcio's HUD tokens; the
  shared components (StatTile, StatusBadge, DataTable, …) are restyled once and reused.
- **Data.** jupigenio's hosted project holds test data only (its D-032), so nothing real is
  migrated. Its migrations are re-applied to the `tiburcio` Supabase project.

**B. The separate agent worker (plan §4, §8) has nowhere to run.** Vercel has no long-running
processes. The chat has to stream from a Route Handler (Vercel functions can stream for
several minutes; check the current Hobby limit before Phase 5), with scheduled work on Vercel
Cron or Supabase `pg_cron`.

**C. The Claude Agent SDK is the wrong tool here.** It drives the Claude Code runtime
(a CLI subprocess with file and shell tools), which is heavy and awkward on serverless.
Tibúrcio's tools are database calls (`projects.list`, `tasks.add`, …). The Anthropic
TypeScript SDK (Messages API with tool use and streaming) does this directly. With jupigenio
inside, the agent can also read and update production projects and tasks.

**D. "Same DB server, separate database, own DB user" (plan rule 2.3).** No longer relevant:
there is one app and one Supabase project, `tiburcio` (ref `quincosoqtgzgjucsidg`,
eu-north-1). See D-001.

**E. Tables the plan lists that Supabase already provides.** `users` and `sessions` become
Supabase Auth (`auth.users`) + a `profiles` table, as in jupigenio. `project_files` points at a
private Supabase Storage bucket.

**F. One `/api/home` call (plan §10).** With Next 16 Cache Components, the faster pattern
(and jupigenio's) is a prerendered static shell with each Home panel as a Server Component in
its own `<Suspense>`. Each source still gets its own timeout and offline state, and a slow
panel never blocks the others. No client-side fetch waterfall, and less JS shipped.

## 3. Tibúrcio will use

**jupigenio's codebase as the starting point.** It already has what plan Phase 1 asks for
(Next.js 16 shell, Supabase login, RLS, tests, CI), so Tibúrcio starts from it instead of an
empty scaffold, with jupigenio's git history kept.

**Same as jupigenio:**
- Next.js 16 (same version), React 19, TypeScript strict, `src/` layout, npm, Node 24.
- Supabase: Postgres + Auth + Storage, RLS on every table, SQL migrations with policies,
  pgTAP tests, CLI pinned at 2.120.0, the `@supabase/ssr` + `proxy.ts` + DAL + Server Actions
  + Zod pattern.
- Tailwind 4 + shadcn/ui + lucide icons, rethemed into the dark green HUD tokens from
  `docs/design/homepage.dc.html`. Orbitron, Rajdhani and Inter through `next/font` (self-hosted,
  subset, which helps the performance budget).
- Vitest, Playwright + axe (desktop 1440 and Pixel 7, plus a 390px check), the same GitHub
  Actions CI, including the secret-in-bundle check.
- Vercel, a new project `tiburcio`, deployed the same way.

**Different from jupigenio and the plan:**
- **Login:** Supabase Auth, sign-up off, one account (Bruno), created by
  `npm run user:create`. No invitations.
- **Modules:** code is split by module under `src/modules/<name>` (routes stay in `src/app`):
  `home`, `chat`, `projects` (personal projects), `jupigenio` (production projects), `photos`,
  `calendar`, `integrations`, `settings`. Each has its own DAL, actions, components and tests,
  and is code-split so it loads only when opened.
- **Personal projects vs jupigenio projects** stay two modules with their own tables: personal
  projects are light (tasks, notes, materials, files); jupigenio projects are the heavy
  planning tool (subprojects, cronograma, dependencies, Gantt). A personal project can be
  "promoted" to jupigenio later if that turns out useful.
- **Chat:** Anthropic TypeScript SDK, streaming from a Route Handler; messages, tool calls and
  token usage stored as they happen; the confirmation flow and `agent_actions` log as planned.
  The `jobs` table stays for retries and scheduled work, run by Vercel Cron or `pg_cron`.
- **Repo:** one Next.js app at the repo root, like jupigenio. When a second app arrives
  (the Phase 8 photo helper), the repo becomes npm workspaces then.

## 4. What happens to the jupigenio repo

- Its code is imported into `tiburcio` with history; the `jupigenio` repo is then archived
  (read-only) on GitHub, not deleted.
- `jupigenio.vercel.app` is switched off, or redirected to Tibúrcio, once the module works.
- Its staging Supabase project (`vuhifzervwszejqdpbnb`) is paused, then deleted only after
  Bruno confirms.

## 5. Open questions for Bruno

1. ~~jupigenio integration~~ **Answered:** jupigenio becomes a module of a single-user
   Tibúrcio (D-003).
2. **Workspaces:** jupigenio groups projects by organization (e.g. one per festival). Keep
   that as "workspaces" you can switch between, or one flat list of production projects?
3. **Chat engine:** OK to use the Anthropic SDK directly instead of the Agent SDK (section 2.C)?
4. **Clock and date:** English (`en-GB`) or Portuguese (`pt-PT`)?
5. **Claude model:** cheaper model by default with a "stronger model" switch per thread, or
   always the strongest? And a monthly spend limit (e.g. stop or warn at €X)?
6. **After GitHub:** Calendar or Gmail first?
7. **Free plans:** the Supabase free project pauses after about a week without use, and Vercel
   Hobby limits function time. Fine for now?
8. **Domain:** not needed anymore for the app to work. Want one anyway (e.g. `tiburcio.pt`)?
