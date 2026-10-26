# Backlog

Small, reviewable tasks. Each one ends with `npm run check` and `npm run build` passing.
Status: ⬜ todo · 🟡 doing · ✅ done. IDs are stable; append rather than renumber.

## Phase 1: App shell and design system

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| P1-01 | Install shadcn/ui (Tailwind 4 mode), `lucide-react`, class merging | `components/ui/button` renders; lint/build pass; deps justified | ✅ shadcn 4.22.1, Radix base, `radix-nova` style; `cn` package (shadcn's clsx+tailwind-merge replacement) |
| P1-02 | Design tokens in `globals.css` (colors incl. status categories, spacing, radius, typography; light + dark) | Tokens used by components; status colours always paired with label/icon | ✅ green brand, tinted canvas, 5 status categories + warning, 6 chart colours, light/dark |
| P1-03 | App shell: sidebar (desktop), drawer (mobile), top bar | Works at 360px and 1440px; keyboard navigable; current route highlighted | ✅ collapsible icon sidebar (Ctrl/⌘+B), mobile drawer, skip link, theme toggle, `aria-current` |
| P1-04 | Routes: dashboard, projects, tasks, materials, reports, team, settings | Each route has a title and an honest empty state ("Nothing here yet — …") | ✅ metrics show "—" + "No data yet"; unbuilt actions are disabled and say which phase |
| P1-05 | Login page UI and signed-out layout (no backend yet) | Form validates with Zod; clearly not wired until Phase 2 | ✅ `useActionState` + shared `loginSchema`; says "Sign-in isn't connected yet" |
| P1-06 | `loading.tsx`, `error.tsx`, `not-found.tsx`, unauthorized page | Each state is reachable and readable | ✅ plus `forbidden.tsx`, `global-error.tsx`; demos under `/design/states/*` |
| P1-07 | Reusable form field, dialog, confirm dialog, data table, badge, toast | Used at least once; a11y labels present | ✅ `TextField`/`TextareaField`, `ConfirmDialog`, `DataTable` (sortable, `aria-sort`), `StatusBadge`/`PriorityBadge`, `StatTile`, `EmptyState`, `DemoDataNotice`, Sonner toasts — all on `/design` |
| P1-08 | Playwright setup and smoke test: navigate every main route | `npm run test:e2e` passes locally | ✅ desktop (1440px) + mobile (Pixel 7) projects, against a production build |
| P1-09 | Accessibility pass (axe in Playwright or manual checklist) | No critical issues on shell routes; documented | ✅ axe WCAG 2.1 AA: 0 serious/critical on 10 pages × light/dark × desktop/mobile; skip-link keyboard test |

## Phase 2: Database, auth, authorization

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| P2-01 | Add Supabase CLI (dev dep), `supabase init`, local stack docs | `npx supabase start` works; README updated | ✅ 2026-10-26: CLI 2.120.0 (pinned dev dep), `npm run db:*` scripts, local auth hardened in `config.toml`, placeholder `seed.sql`, README section |
| P2-02 | `@supabase/ssr` clients (server/browser/admin) + `src/proxy.ts` session refresh | Admin client is `server-only`; no secret in client bundle (verified by grep of `.next/static`) | ✅ 2026-10-26: server client + proxy; grep of `.next/static` finds no secret key, `sb_secret_`, `service_role` or `SUPABASE_SECRET_KEY`. Browser client deferred until a client component needs it; admin client arrives with P2-08 |
| P2-03 | Migration: `profiles`, `organizations`, `organization_members`, `invitations` + RLS + helper functions | RLS enabled on all; `create_organization` fn; last-admin guard | ✅ 2026-10-26: checked by hand (rolled-back SQL: cross-org reads/writes, role limits, last admin, anon); `supabase db lint` clean. Automated tests: P2-04/05 |
| P2-04 | RLS test harness (SQL tests against local Supabase) | Script `npm run test:db`; runs in a clean DB | ✅ 2026-10-26: pgTAP via `supabase test db`; each file is one rolled-back transaction; passes after `db:reset` |
| P2-05 | RLS tests: org isolation and roles | User in org A cannot select/insert/update/delete org B rows; external/member limits proved | ✅ 2026-10-26: `supabase/tests/tenancy_rls.test.sql`, 37 checks (anon, admin, PM, member, external, no-org user, last admin). Verified it fails when a policy is weakened |
| P2-06 | Auth flows: login, logout, auth callback, DAL `getCurrentUser` | Protected routes redirect; session read is behind Suspense | ✅ 2026-10-26: sign in/out, `/auth/confirm` for email links, `getCurrentUser`/`requireUser`, safe `next=` redirects (unit-tested), account menu in Suspense; E2E sign in once via `auth.setup.ts` |
| P2-07 | Bootstrap the first organization + admin (operator script; seed locally) and org switcher | No self-service org creation (D-021); a signed-in user with no membership sees a clear "ask for an invitation" screen; users in several orgs can switch | ✅ 2026-10-26: `npm run org:create` (operator, refuses non-local without `--yes`); routes under `/[org]/` with membership gate; `/` picks the org; `/no-organization`; sidebar org switcher with role. Local seed org: P2-09 |
| P2-08 | Invitations: admin invites by email with role; accept page | Invite-only (public sign-up disabled, D-021); invite works with sign-up off; token expires; accepted user joins with that role | ✅ 2026-10-26: Team page (members, invite, open invitations, revoke); email via Supabase for new people, shareable link for existing accounts; `/accept-invite` (new people set a password); `accept_invitation` checks email, expiry, revocation, single use. 16 pgTAP + 4 E2E tests incl. the real email from Mailpit |
| P2-09 | Seed data (`supabase/seed.sql`): 2 orgs, users per role, labelled demo | Used by RLS and E2E tests; clearly fake names | ⏭ Skipped 2026-10-26 (product owner). RLS tests and E2E create their own fictional fixtures; revisit if a demo database is wanted |
| P2-10 | CI workflow (GitHub Actions): lint, typecheck, unit, build (+ db tests if feasible) | Green on main | 🟡 2026-10-26: `.github/workflows/ci.yml` (checks + build + bundle secret scan; local Supabase → pgTAP + Playwright). Every step verified locally, incl. the slimmed Supabase stack. **Green on GitHub pending**: the repo has no remote yet |

## Phase 3: Project hierarchy and tasks

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| P3-00 | Clickable prototype of the subproject workspace (D-019) at `/projects/prototype` | Demo data only, labelled; cronograma/materials/people/history tabs; daily check-in; previews and overlap warnings; E2E + axe | ✅ 2026-10-26, plus progress donuts, red overlaps and an "All materials" view at `/projects/prototype/materials` (2 demo projects). Rules in `lib/domain/schedule.ts` and `progress.ts` (unit-tested) |
| — | ~~P3-00b, P3-01, P3-02, P3-03, P3-04, P3-05, P3-06, P3-07, P3-08, P3-09, P3-10~~ | Superseded by D-025 (prototype as spec): recursive projects, project members, status definitions, task assignees and Kanban are not in Phase 3 | ⏭ |
| P3-11 | Migration: `projects`, `subprojects`, `crew_members` + RLS + pgTAP | Members read, admin/PM write, externals nothing; owner must be crew of the same subproject; same-org FKs | ⬜ |
| P3-12 | Migration: `tasks`, `subproject_materials`, `subproject_dependencies`, `plan_baselines`, `activity_log` + RLS + pgTAP | Dependencies only within one project, no cycles; activity log append-only | ⬜ |
| P3-13 | Projects page: list, create, edit, archive projects | Persists after refresh; members see no edit buttons and the server refuses their edits | ⬜ |
| P3-14 | Project page: subproject cards, add/edit/archive subproject, dependencies, timeline, progress donut, red overlaps | Matches the prototype; dates from tasks | ⬜ |
| P3-15 | Subproject Cronograma tab: add/update/archive tasks with change preview, status, progress, actual dates | Later tasks shift; other subprojects never move; overlaps previewed | ⬜ |
| P3-16 | Subproject Materials tab + organization "All materials" page with filters | Replaces the `/materials` placeholder | ⬜ |
| P3-17 | Subproject Crew tab; owner picked from crew | Owner shown on cards and timeline | ⬜ |
| P3-18 | History tab + project history, lock plan (baseline, "vs. original"), daily check-in | Every change logged with optional reason | ⬜ |
| P3-19 | Permissions in the UI: members read-only, externals no projects | E2E as member and external; RLS already proves it | ⬜ |
| P3-20 | Remove the prototype; E2E vertical slice | Create Main Stage + 3 subprojects + tasks by UI, delay a task → red overlap, survives refresh | ⬜ |

## Phases 4–9

Broken down when Phase 3 is complete. Known early items:
- P4: `task_dependencies` + cycle trigger + tests, Gantt library evaluation (record in DECISIONS), overdue/blocked indicators.
- P5: materials, locations, ledger, `post_material_movement` / `reserve_material` with concurrency tests, the "12 plywood sheets for DJ task" scenario.
- P6: budgets/expenses, Recharts dashboard from real queries, drill-down, CSV export via RLS-scoped route.

### Requirements observed in the team's own spreadsheets (2026-10-26)

From the reference files in `example files/` (git-ignored: they contain real names
and budgets). Use them to shape later phases; demo/seed data must stay fictional.

- **Project = area or artwork, owned by an artist/team** (e.g. a stage, a DJ booth,
  a sculpture), with its own budget and start/end dates. This fits the nested `projects` model (P3).
- **Production phases:** pre-production → festival → post-production. Consider
  phase milestones or a project "phase" field (P4).
- **Daily crew planning:** per task and per day, *planned* crew headcount vs
  *actual* crew, plus machinery/equipment. This is a resource-planning view that is
  not in the blueprint yet. Candidate P4/P7 item: `task_crew_plan(task_id, date, planned, actual)`.
- **Material request flow** per project/artist: *to request* → *requested* →
  *ready for pick-up at the warehouse (almoxarifado)* → plus *under review*. Maps to
  `material_allocations.status` (P5). Free-text quantities like "2 rolls", "3 kg" and
  "2 packs of 50" show that each material needs a proper unit and pack-size
  conversion (P5).
- **Content language is Brazilian Portuguese** → see DECISIONS Q1/Q2.

---

## Phase 0 verification log

2026-10-26, Windows 11, Node 24.22.1, npm 11.19.1:
- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm test`: pass (Vitest 5.0.5, no test files yet, `passWithNoTests`)
- `npm run build`: pass (Next 16.4.3 Turbopack; `/` static)
- `npm start` + GET `/`: HTTP 200, placeholder page served


## Phase 1 verification log

2026-10-26, Windows 11, Node 24.22.1, Next 16.4.3, Chromium 156 (Playwright 1.64.1):
- `npm run lint`: pass
- `npm run typecheck` (`next typegen && tsc --noEmit`): pass
- `npm test`: pass, 19 tests in 3 files (sort comparator, navigation config incl. "every nav item has a page", login schema)
- `npm run build`: pass, 15 routes (14 static, `/design/states/loading` partial prerender)
- `npm run test:e2e`: 81 passed, 5 skipped (desktop-only/mobile-only cases), covering:
  every route + titles, root redirect, no fabricated metrics, sidebar navigation and
  collapse, mobile drawer, no horizontal scroll at 412px, 404/401/403 with correct HTTP
  status, error boundary, loading skeleton, login validation, table sorting, confirm dialog,
  skip link, and axe WCAG 2.1 AA (0 serious/critical) in light and dark.
- Manual visual check (screenshots): dashboard light/dark, design system, login, mobile drawer, mobile empty state.