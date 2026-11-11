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

## 2. Where the plan doesn't fit jupigenio

**A. The jupigenio integration (plan §7) is dropped (Bruno, 2026-11-11, D-002).**
Tibúrcio is a new, independent project. jupigenio gets **no changes**: no proxy, no HMAC
auth mode, no base path, no summary endpoint. Tibúrcio only has a **jupigenio tab** that
shows the jupigenio app in a full-height frame. (The plan's proxy design also didn't fit
Vercel: jupigenio is public there, and Supabase Auth can't trust a header login.)

What the frame can and can't do, checked on 2026-11-11:
- `jupigenio.vercel.app` sends no `X-Frame-Options` or `frame-ancestors`, so it loads in a frame.
- Its Supabase session cookie is `SameSite=Lax`. `*.vercel.app` is a public suffix, so
  `tiburcio.vercel.app` and `jupigenio.vercel.app` are **different sites**, and browsers won't
  keep the jupigenio login inside the frame.
- **Fix without touching jupigenio's code:** give both apps subdomains of one custom domain
  (e.g. `tiburcio.<domain>`, `jupigenio.<domain>`, added in Vercel). They become the same site,
  and the login works in the frame.
- Until then the tab shows the frame plus an "Open in new tab" button, and says why.

**B. The separate agent worker (plan §4, §8) has nowhere to run.** Vercel has no long-running
processes. The chat has to stream from a Route Handler (Vercel functions can stream for
several minutes; check the current Hobby limit before Phase 5), with scheduled work on Vercel
Cron or Supabase `pg_cron`.

**C. The Claude Agent SDK is the wrong tool here.** It drives the Claude Code runtime
(a CLI subprocess with file and shell tools), which is heavy and awkward on serverless.
Tibúrcio's tools are database calls (`projects.list`, `tasks.add`, …). The Anthropic
TypeScript SDK (Messages API with tool use and streaming) does this directly.

**D. "Same DB server, separate database, own DB user" (plan rule 2.3).** On Supabase one
project is one database with its own Auth. Tibúrcio already has its **own Supabase project**
(`tiburcio`, ref `quincosoqtgzgjucsidg`, eu-north-1, same org). That gives the isolation the
rule wanted. See DECISIONS D-001.

**E. Tables the plan lists that Supabase already provides.** `users` and `sessions` become
Supabase Auth (`auth.users`) + a `profiles` table, as in jupigenio. `project_files` points at a
private Supabase Storage bucket.

**F. One `/api/home` call (plan §10).** With Next 16 Cache Components, the faster pattern
(and jupigenio's) is a prerendered static shell with each Home panel as a Server Component in
its own `<Suspense>`. Each source still gets its own timeout and offline state, and a slow
panel never blocks the others. No client-side fetch waterfall, and less JS shipped.

## 3. Tibúrcio will use

**Same as jupigenio:**
- Next.js 16 (same version), React 19, TypeScript strict, `src/` layout, npm, Node 24.
- Supabase: Postgres + Auth + Storage, RLS on every table (`user_id = auth.uid()`), SQL
  migrations with policies, pgTAP tests, CLI pinned at 2.120.0, the `@supabase/ssr` +
  `proxy.ts` + DAL + Server Actions + Zod pattern.
- Tailwind 4 + shadcn/ui + lucide icons, rethemed into the dark green HUD tokens from
  `docs/design/homepage.dc.html`. Orbitron, Rajdhani and Inter through `next/font` (self-hosted,
  subset, which helps the performance budget).
- Vitest, Playwright + axe (desktop 1440 and Pixel 7, plus a 390px check), the same GitHub
  Actions CI, including the secret-in-bundle check.
- Vercel, a new project `tiburcio`, deployed the same way.

**Different from the plan:**
- **Login:** Supabase Auth, sign-up off; Bruno's account is created by `npm run user:create`
  (secret key, like jupigenio's `org:create`).
- **Chat:** Anthropic TypeScript SDK, streaming from a Route Handler; messages, tool calls and
  token usage stored as they happen; the confirmation flow and `agent_actions` log as planned.
  The `jobs` table stays for retries and scheduled work (feed polling), run by Vercel Cron or
  `pg_cron`.
- **jupigenio:** one tab with the app in a frame (`JUPIGENIO_URL`, default
  `https://jupigenio.vercel.app`), lazy-loaded so it costs nothing until opened, with an
  "Open in new tab" button. The Home jupigenio panel becomes a shortcut to that tab with no
  project data, because Tibúrcio doesn't read jupigenio's data. Tibúrcio's CSP allows
  `frame-src` for that URL only.
- **Structure for a big project:** an **npm workspaces monorepo** from day one, so later
  pieces have a home without a restructure:
  - `apps/web`: the Next.js app (all modules, deployed to Vercel);
  - later `apps/photo-helper` (Phase 8, the local helper for drives and USB) and possibly a
    native Android wrapper (Phase 7);
  - `packages/*` only when a second app needs to share code (no empty packages up front).
  - Inside `apps/web`, code is split **by module** (`home`, `chat`, `projects`, `photos`,
    `calendar`, `integrations`, `settings`), each with its own routes, DAL, actions,
    components and tests, so modules stay independent and lazy-loadable.

## 4. jupigenio changes needed

**None** (D-002). jupigenio stays exactly as it is.

## 5. Open questions for Bruno

1. ~~jupigenio integration~~ **Answered:** new independent project; jupigenio is only a tab
   with the app in a frame (D-002).
2. **Domain:** is there a domain to use for both apps? Without one, the jupigenio tab can't
   keep you signed in (section 2.A).
3. **Chat engine:** OK to use the Anthropic SDK directly instead of the Agent SDK (section 2.C)?
4. **Clock and date:** English (`en-GB`) or Portuguese (`pt-PT`)?
5. **Claude model:** cheaper model by default with a "stronger model" switch per thread, or
   always the strongest? And a monthly spend limit (e.g. stop or warn at €X)?
6. ~~jupigenio account~~ No longer needed: Tibúrcio doesn't read jupigenio data.
7. **After GitHub:** Calendar or Gmail first?
8. **Free plans:** the Supabase free project pauses after about a week without use, and Vercel
   Hobby limits function time. Fine for now?
