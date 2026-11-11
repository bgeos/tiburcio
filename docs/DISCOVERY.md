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

**A. The jupigenio integration (plan §7) assumes a self-hosted server.**
The plan reverse-proxies `/jupigenio/*` through Tibúrcio, keeps jupigenio reachable only from
localhost or a private network, and signs requests with an HMAC header. On Vercel:
- jupigenio is public on `jupigenio.vercel.app`; there is no private network to hide it in, so
  the HMAC check would become the *only* protection, which the plan itself rules out;
- "trust a header and log the user in" doesn't work with Supabase Auth + RLS: jupigenio would
  have to mint a Supabase session for that email with its secret key on every visit;
- jupigenio has no base path support, and Next's `basePath` is fixed at build time, so
  standalone and embedded jupigenio would need two different builds.

An iframe of `jupigenio.vercel.app` inside Tibúrcio on another domain won't keep the session
either: the cookie would be cross-site, and browsers block those.

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
- **jupigenio, v1:** a **link out**. The "jupigenio" nav item and "Open jupigenio" button open
  `jupigenio.vercel.app` in its own tab; Bruno signs in there once and the session is
  remembered. The **Home panel** shows real jupigenio projects through one small read-only
  endpoint (section 4).
- **jupigenio, later (optional):** embed it in a frame once both apps share a custom domain
  (e.g. `tiburcio.<domain>` and `jupigenio.<domain>`), so cookies are same-site. Real single
  sign-on can be designed then if still wanted.

## 4. jupigenio changes needed

All on branch `feat/tiburcio-integration`, as a PR, never pushed to `main`. Off unless
configured, so standalone jupigenio is unchanged.

1. **Env flag:** `TIBURCIO_INTEGRATION_SECRET` (server only). When it's unset, the endpoint
   below returns 404.
2. **Endpoint:** `GET /api/integration/summary?email=<email>`, with header
   `Authorization: Bearer <secret>`, compared in constant time. Returns
   `{ projects: [{ id, name, status, updatedAt, url }], counts: { planning, active, finished } }`
   for the non-archived projects of every organization that email belongs to. `url` is the
   jupigenio address (`/<org>/projects/<id>`). Rate-limited, and the response is not cached by
   the CDN.
3. **SQL function** `public.integration_project_summary(p_email text)`, `security definer`, empty
   `search_path`, **executable only by `service_role`**, in a new migration, so the endpoint
   reads only what it returns instead of using the admin client freely. This becomes the
   admin client's second use, which needs a jupigenio DECISIONS entry.
4. **Tests:** pgTAP (`anon` and `authenticated` can't call the function; it returns only that
   person's organizations), and Vitest for the handler (no secret → 404, wrong secret → 401,
   missing email → 400, happy path).
5. Later, only if we embed: `Content-Security-Policy: frame-ancestors` allowing the Tibúrcio
   domain.

Tibúrcio's side: the Home panel fetches this server-side, caches it for 60 s per user, and
shows "jupigenio offline" on timeout (1.5 s) or error.

## 5. Open questions for Bruno

1. **jupigenio integration:** OK with a link out + real summary on Home for now (section 3),
   embedding later once there's a custom domain?
2. **Domain:** is there a domain to buy or use for Tibúrcio (and later jupigenio), or is
   `tiburcio.vercel.app` fine for now?
3. **Chat engine:** OK to use the Anthropic SDK directly instead of the Agent SDK (section 2.C)?
4. **Clock and date:** English (`en-GB`) or Portuguese (`pt-PT`)?
5. **Claude model:** cheaper model by default with a "stronger model" switch per thread, or
   always the strongest? And a monthly spend limit (e.g. stop or warn at €X)?
6. **jupigenio account:** which email do you use in jupigenio? The summary matches on it. And
   are there other jupigenio users (from Bruno's plan question 4)? The endpoint above only
   reads, so it doesn't affect them.
7. **After GitHub:** Calendar or Gmail first?
8. **Free plans:** the Supabase free project pauses after about a week without use, and Vercel
   Hobby limits function time. Fine for now?
