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
| P2-01 | Add Supabase CLI (dev dep), `supabase init`, local stack docs | `npx supabase start` works; README updated | ⬜ |
| P2-02 | `@supabase/ssr` clients (server/browser/admin) + `src/proxy.ts` session refresh | Admin client is `server-only`; no secret in client bundle (verified by grep of `.next/static`) | ⬜ |
| P2-03 | Migration: `profiles`, `organizations`, `organization_members`, `invitations` + RLS + helper functions | RLS enabled on all; `create_organization` fn; last-admin guard | ⬜ |
| P2-04 | RLS test harness (SQL tests against local Supabase) | Script `npm run test:db`; runs in a clean DB | ⬜ |
| P2-05 | RLS tests: org isolation and roles | User in org A cannot select/insert/update/delete org B rows; external/member limits proved | ⬜ |
| P2-06 | Auth flows: login, logout, auth callback, DAL `getCurrentUser` | Protected routes redirect; session read is behind Suspense | ⬜ |
| P2-07 | Create-organization flow and org switcher | New user with no org is guided to create one; becomes admin | ⬜ |
| P2-08 | Invitations: admin invites by email with role; accept page | Invite-only; token expires; accepted user joins with that role | ⬜ |
| P2-09 | Seed data (`supabase/seed.sql`): 2 orgs, users per role, labelled demo | Used by RLS and E2E tests; clearly fake names | ⬜ |
| P2-10 | CI workflow (GitHub Actions): lint, typecheck, unit, build (+ db tests if feasible) | Green on main | ⬜ |

## Phase 3: Project hierarchy and tasks

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| P3-00 | Clickable prototype of the subproject workspace (D-019) at `/projects/prototype` | Demo data only, labelled; cronograma/materials/people/history tabs; daily check-in; previews and overlap warnings; E2E + axe | ✅ 2026-10-26, plus progress donuts, red overlaps and an "All materials" view at `/projects/prototype/materials` (2 demo projects). Rules in `lib/domain/schedule.ts` and `progress.ts` (unit-tested) |
| P3-00b | Revise DATA_MODEL for D-019 after prototype feedback | Owner = crew person; task duration + wait days; `project_dependencies` between subprojects; `project_materials` (description + status); `crew_members`; baseline snapshots; history with reason | ⬜ |
| P3-01 | Migration: `status_definitions` (+ default seeding per org), `projects`, `project_members` + RLS | Composite same-org FKs; cycle-prevention trigger; RLS tests | ⬜ |
| P3-02 | Migration: `tasks`, `task_assignees`, `activity_log` (tasks/projects) + RLS | Subtask same-project trigger; audit rows written; RLS tests | ⬜ |
| P3-03 | `lib/domain/progress.ts` + unit tests | Implements DATA_MODEL progress rule incl. empty → null, cancelled excluded, no double count | ⬜ |
| P3-04 | Projects list + create/edit/archive project & subproject (UI + actions) | Main Stage → 4 subprojects created via UI; persists after refresh | ⬜ |
| P3-05 | Project detail: children, owner, members, progress with method label | Progress matches P3-03 rule; empty state handled | ⬜ |
| P3-06 | Task CRUD: create/edit/archive tasks and subtasks, assignees, status, priority, dates, progress | Validation errors shown; archive confirmed | ⬜ |
| P3-07 | Table view with sort/filter/search (+ pagination if > 50 rows) | Filters predictable; URL reflects filter state | ⬜ |
| P3-08 | Kanban view by status (drag or menu to move) | Moving a card persists; keyboard alternative exists | ⬜ |
| P3-09 | Project members & roles UI | Owner of DJ Area can edit DJ tasks but not Stage tasks (RLS test + E2E) | ⬜ |
| P3-10 | E2E: first vertical slice (see ROADMAP) | Passes against local Supabase seed | ⬜ |

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