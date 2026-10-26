# Architecture

Status: **planned** (Phase 0). Sections marked *(Phase N)* do not exist in code yet.

## Overview

```
Browser (React 19 client components, forms)
   │  HTTPS
   ▼
Next.js 16 app (Vercel)
   ├─ src/proxy.ts ............ refreshes Supabase session cookie, optimistic
   │                            redirect of signed-out users (NOT authorization)
   ├─ Server Components ....... read data through the Data Access Layer (DAL)
   ├─ Server Actions .......... all mutations; Zod-validated; re-check auth
   └─ Route Handlers .......... CSV exports, auth callback, webhooks
   │  user JWT (anon/publishable key + session)   │ secret key (rare, server-only)
   ▼                                              ▼
Supabase
   ├─ Postgres ............ tables + RLS policies + SQL functions/triggers
   ├─ Auth ................ email/password + magic link; invitations
   └─ Storage ............. private buckets, policies mirror project access
```

**Core idea:** Postgres Row Level Security is the primary authorization
boundary. The app talks to Supabase *as the signed-in user*, so even a bug in
a Server Action cannot read another organization's rows. Server-side checks in
the DAL and actions add defence in depth and give good error messages.

## Code layout

✅ = exists (Phase 1). The rest is the target.

```
src/
  app/
    layout.tsx                              ✅ root: fonts, Providers (theme, tooltips, toasts)
    not-found | unauthorized | forbidden | global-error .tsx   ✅ full-page states
    (auth)/login                            ✅ signed-out layout + login form (not wired)
    (auth)/accept-invite                    Phase 2
    (app)/layout.tsx                        ✅ app shell: sidebar, header, skip link
    (app)/loading.tsx, error.tsx            ✅ section loading skeleton + error boundary
    page.tsx                                `/`: picks the person's organization (D-023)
    (auth)/no-organization                  ✅ signed in, no membership: ask for an invitation
    (app)/[org]/layout.tsx                  ✅ membership gate (non-members → 404)
    (app)/[org]/dashboard | projects | tasks | materials | reports | team | settings   ✅ (D-016)
    (app)/design/…                          ✅ internal component/state reference (demo data)
    auth/confirm/route.ts                   ✅ email links (invite, recovery): verifyOtp → redirect
  components/
    ui/                                     ✅ shadcn/ui primitives (generated, editable)
    shell/                                  ✅ app-sidebar, app-header, theme-toggle, account-menu
    form/                                   ✅ TextField / TextareaField (label, description, error, aria)
    data-table, confirm-dialog, empty-state, stat-tile, status-badge,
    page-header, status-screen, demo-data-notice, coming-soon-action   ✅ shared building blocks
    <feature>/                              feature components
  lib/
    supabase/server.ts                      createServerClient (cookies) — server-only
    supabase/client.ts                      createBrowserClient
    supabase/admin.ts                       secret-key client — server-only, rare
    dal/                                    Data Access Layer: getCurrentUser, getProjects…
    domain/                                 ✅ status.ts; pure business rules (progress, stock math) + tests
    validation/                             ✅ Zod schemas + parseForm, shared by forms and actions
    navigation.ts, sort.ts                  ✅ nav config, table sort comparator (+ tests)
    demo/                                   ✅ fictional data for /design only. Never used in real pages
  hooks/                                    ✅ use-mobile
  proxy.ts                                  Next 16 "Proxy" (formerly middleware)
supabase/
  migrations/                               SQL migrations (schema + RLS together)
  seed.sql                                  local demo data (clearly fake)
  tests/                                    SQL/RLS tests
e2e/                                        ✅ Playwright smoke + axe tests (desktop & mobile)
docs/
```

Rules:
- `lib/domain/*` holds pure TypeScript with no I/O. Business rules (progress
  roll-up, available stock) live here and in SQL, and both are unit-tested.
- Anything that touches secrets or the admin client starts with `import "server-only"`.
- Client components never import from `lib/dal` or `lib/supabase/server`.

## Next.js 16 specifics

- **Cache Components (`cacheComponents: true`)** is enabled. Reading
  `cookies()`/the session is a request-time read and must sit inside a
  `<Suspense>` boundary. The static shell (nav chrome, labels) prerenders, and
  user data streams in.
- **No server-side `"use cache"` for org data initially.** Supabase queries
  run with the user's JWT so RLS applies. Caching them on the server would risk
  cross-user leaks via cache keys. If performance requires it later, use
  `"use cache: private"` or key strictly by user id plus tags, and document it in
  DECISIONS.md.
- **Proxy** (`src/proxy.ts`, formerly middleware) only refreshes the session
  and does optimistic redirects. Real authorization is done in the DAL, the actions, and RLS.
- Mutations go through **Server Actions**, which re-read the session, validate
  input with Zod, call Supabase as the user, then `updateTag`/`refresh` the affected views.
  Forms use `useActionState` with the shared `parseForm` helper (D-013).
- **Loading boundaries:** client navigation inside the app shell does not re-show
  `(app)/loading.tsx`. Every page that reads data needs its own `loading.tsx` or
  `<Suspense>` (D-017).
- **Error files:** in Next 16, `error.tsx` receives `{ error: unknown, retry }` (not `reset`).
- **401/403:** `unauthorized()` / `forbidden()` (experimental `authInterrupts`, D-015)
  render `src/app/unauthorized.tsx` / `forbidden.tsx` with the correct HTTP status.

## Design system

- Tokens in `src/app/globals.css`: tinted canvas behind white cards, green primary,
  status-category colours (`status-todo|in-progress|blocked|done|cancelled` + `-soft`),
  `warning`, six chart colours, light and dark (`.dark` class via next-themes).
- Status is never shown by colour alone: `StatusBadge` = icon + label + colour.
- No fabricated numbers: `StatTile` renders `null` as "—" + "No data yet". Sample data
  must be wrapped in `DemoDataNotice`. Features that aren't built yet are shown as
  disabled actions that state their phase (`ComingSoonAction`).
- Visual reference: light, airy cards with stat tiles and donut/bar charts, inspired by
  (not copied from) a reference screenshot provided by the team.

## Security model

| Layer | Responsibility |
| --- | --- |
| Supabase Auth | Identity, sessions, password and magic-link handling |
| RLS (Postgres) | Org isolation and role/project permissions on every table |
| SQL functions (`security definer`, narrow) | Multi-row invariants: stock movements, dependency cycle checks, org creation |
| DAL / Server Actions | Re-verify session, validate input, friendly errors |
| UI | Hide actions the user can't perform (convenience only) |

- Invite-only sign-up initially. The admin client (secret key) is used only to send invitations.
- Helper SQL functions `private.is_org_member(org_id)`, `private.has_org_role(org_id, roles[])`
  and (Phase 3) `private.can_access_project(project_id)` are used by policies. They live in
  the `private` schema, which the Data API doesn't expose, and are `security definer` with an
  empty `search_path` to avoid RLS recursion and search-path hijacking.
- Storage buckets are private. Object paths start with `org_id/project_id/`,
  and storage policies call the same helpers.
- Exports (CSV) go through Route Handlers that use the user-scoped client, so they get
  the same RLS as pages.
- Audit: triggers write `activity_log` rows for task date/status changes,
  stock movements, cost changes and permission changes.

## Roles (initial)

Organization roles (`organization_members.role`):
- `admin`: everything, including members and settings.
- `production_manager`: all projects, materials and budgets. No org settings or billing.
- `member`: sees projects they are a member of. Edits according to project role.
- `external`: like `member`, but limited to explicitly shared projects. Cannot see the
  material catalogue, costs or member list unless granted.

Project roles (`project_members.role`): `owner`, `editor`, `viewer`.
Access to a project is inherited by its descendants unless restricted later.

## Environments and deployment

| | Local | Preview / staging | Production |
| --- | --- | --- | --- |
| App | `npm run dev` | Vercel preview per branch/PR | Vercel production, custom domain |
| DB | `npx supabase start` (Docker) | Separate Supabase project | Own Supabase project with backups (PITR) |
| Data | `supabase/seed.sql` demo data | Synthetic test data only | Real data |
| Secrets | `.env.local` (untracked) | Vercel env (Preview) | Vercel env (Production) |

Migrations are applied with `npx supabase db push` against staging first,
then production, after review. Never edit a production schema by hand.

## Testing strategy

- **Unit (Vitest):** `lib/domain` rules (progress roll-up, stock availability,
  dependency cycles, money math) and Zod schemas.
- **Database/RLS:** SQL tests run against local Supabase. Each table gets tests
  showing that user A of org 1 cannot select/insert/update rows of org 2, plus
  role checks.
- **E2E (Playwright, ✅ set up):** runs against `next build && next start` on port 3100, in
  `desktop` (1440×900) and `mobile` (Pixel 7) projects. It includes axe WCAG 2.1 AA checks in
  light and dark. Next flows: sign in, create a project and subproject, add a task, reserve material.
- CI (Phase 9 at the latest, ideally Phase 2): lint, typecheck, unit, RLS tests, build.
