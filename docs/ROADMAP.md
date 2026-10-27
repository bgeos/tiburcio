# Roadmap

Legend: ✅ done · 🟡 in progress · ⬜ not started. Detailed tasks are in [BACKLOG.md](BACKLOG.md).
Full acceptance criteria are in `PROJECT_BLUEPRINT.md` § 6.

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Inspect, plan, prepare | ✅ |
| 1 | App shell and design system | ✅ |
| 2 | Database, auth, authorization | ✅ |
| 3 | Project hierarchy and tasks | ✅ |
| 4 | Scheduling and dependencies | ✅ |
| 5 | Materials and inventory | ✖ dropped |
| 6 | Budgets, analytics, reports | ⬜ |
| 7 | Customization and templates | ⬜ |
| 8 | PWA and field operations | ⬜ |
| 9 | Production hardening and launch | ⬜ |

## Phase 0: Inspect, plan, prepare ✅ (2026-10-26)

- [x] Inspected repo: fresh create-next-app (Next 16.4, React 19.3, Tailwind 4, Vitest), npm, Node 24, Docker available.
- [x] Git repository on `main`.
- [x] `CLAUDE.md` (imports `AGENTS.md`), `README.md`, `.env.example`, `docs/`.
- [x] ARCHITECTURE, DATA_MODEL, ROADMAP, BACKLOG, DECISIONS (with open questions).
- [x] Scripts: `typecheck`, `test`, `check`. Vitest config.
- [x] Default starter page replaced by a neutral placeholder.
- [x] Verified: lint, typecheck, test (no tests yet), build. See BACKLOG for results.

## First vertical slice (target: end of Phase 3)

> A production manager signs in, creates an organization, creates **Main Stage**
> with a **DJ Area** subproject owned by another member, adds a task with status,
> dates and progress, and sees it in the table view. The data persists after refresh,
> and a user from another org cannot see any of it (proved by an RLS test and an E2E test).

This slice is the first end-to-end proof of the blueprint's core loop. Phases 1–3 are
ordered so that each step of it can be built and tested in turn.

## Phase 1: App shell and design system ✅ (2026-10-26)
Accept: consistent desktop/mobile shell, working navigation, no fake metrics,
accessibility and responsive behavior checked. Backlog P1-01 … P1-09 all done.

- [x] shadcn/ui (Radix) + design tokens (green brand, status categories, light/dark via next-themes).
- [x] App shell: collapsible sidebar, mobile drawer, top bar, skip link, theme toggle, honest signed-out state.
- [x] Routes: `/dashboard` (`/` redirects there), `/projects`, `/tasks`, `/materials`, `/reports`, `/team`, `/settings`, `/login`.
- [x] States: loading, error, global error, 404, 401 (`unauthorized()`), 403 (`forbidden()`).
- [x] Components on `/design` (internal reference; clearly labelled demo data only).
- [x] Unit tests (Vitest) + E2E/axe tests (Playwright) passing. See BACKLOG § Phase 1 verification log.

Known limits, carried forward:
- ~~No auth yet~~: since P2-06 every app page requires sign-in.
- ~~Routes have no `/[org]` prefix~~: since P2-07 every section lives under `/<org>/` (D-016).
- `/design` is public. Review for removal or admin-only access in Phase 9.
- UI strings are English and not yet externalised (Q1).

## Phase 2: Database, auth, authorization ✅ (2026-10-26)
- [x] P2-01 local Supabase stack (2026-10-26).
- [x] P2-03 identity and tenancy tables with RLS (2026-10-26).
- [x] P2-04/05 database tests: org isolation and role limits, `npm run test:db` (2026-10-26).
- [x] P2-02/06 Supabase clients, proxy session refresh, sign in/out (2026-10-26).
- [x] P2-07 organization URLs `/[org]/…`, switcher, no-organization page, `org:create` (2026-10-26).
- [x] P2-08 invitations: invite, email/link, accept, revoke (2026-10-26).
- [ ] ~~P2-09 seed data~~ skipped by the product owner; tests create their own fixtures.
- [x] P2-10 CI workflow written and verified locally; first green run on GitHub needs a remote.

Acceptance: signed-out visitors are redirected and get no data (E2E + RLS for `anon`);
org isolation and role limits are proved by 54 pgTAP tests; no secret in client code
(bundle scan in CI) or in Git (`.env*` ignored).
Accept: unauthenticated users blocked, org isolation proved by tests, role
permissions tested, no secrets in client or Git. Backlog P2-*.

## Phase 3: Projects and tasks ✅ (2026-10-26)
Product shape agreed in D-019 and confirmed in D-025: the prototype (removed in P3-20, still in Git history)
was the spec (subproject = Cronograma + Materials + Crew + History). Backlog P3-11 … P3-20.

- [x] P3-11 … P3-18 (2026-10-26): tables with RLS, Projects page, project page, Cronograma,
  Materials (+ All materials), Crew and owner, History, lock plan, daily check-in.
- [x] P3-19 (2026-10-26): members see everything read-only (no editing controls, no check-in);
  external collaborators get a clear "no projects" message and direct links are 404s.
- [x] P3-20 (2026-10-26): prototype removed; end-to-end vertical slice through the UI only.

Accept: Main Stage with 4 subprojects created via UI, each with its own owner and tasks,
edits persist, parent summaries follow the documented progress rule. Backlog P3-*.
Met by `e2e/vertical-slice.spec.ts` (UI only, survives a reload, another organization gets a 404)
plus the pgTAP RLS tests.

## Phase 4: Scheduling and dependencies ✅ (2026-10-27)
- [x] P4-01 (2026-10-26): task dependencies across subprojects and projects (D-027).
- [x] P4-02 (2026-10-27): "My tasks" (personal to-dos and reminders) replaces the Tasks placeholder; Reports removed from the navigation (D-028).
- [x] P4-03 (2026-10-27): the project status follows the work (D-029).
- [x] P4-04 (2026-10-27): overdue and blocked indicators on the cronograma, project page and Overview.
- [x] P4-05 (2026-10-27): organization-wide milestones; tasks must be done before them (D-030).
- [x] P4-06 (2026-10-27): read-only Gantt view per project, built on our own timeline (D-031).
- [x] P4-07 (2026-10-27): Calendar view (month / week, all projects or one).
- [x] P4-08 (2026-10-27): phase closed: limitations below, dependency edge cases tested, acceptance checked. The "Risks" panel was dropped by the product owner.

Acceptance (blueprint § 6, Phase 4):
- *A task can depend on work in another subproject*: task links across subprojects and projects
  (`task_dependencies` pgTAP, `e2e/task-links.spec.ts`).
- *Invalid dependency cycles are rejected*: subproject and task circles refused by triggers
  (pgTAP incl. a two-task circle; E2E "a circle of links is refused").
- *Changes persist and affect relevant views*: cronograma, project page, Gantt, calendar and
  Overview read the same saved plan (E2E specs reload and check each view).
- *The dashboard identifies schedule risks without pretending to calculate a critical path*:
  the Overview and project page show overlaps, overdue, blocked and milestone-late work; no
  critical path is claimed.
- Calendar and Gantt views (Gantt without a library, D-031), milestones (D-030), overdue and
  blocked warnings (P4-04), planned vs actual dates (Phase 3) and original plan (locked baseline).

Known limitations (by design, for now):
- Dates are **calendar days**: no weekends, holidays or working hours.
- **Nothing moves by itself**: a later task never shifts another subproject, linked task or
  milestone; clashes are shown in red with a preview before saving (D-019).
- Only **finish-to-start** links; no lags, start-to-start or partial overlaps allowed on purpose.
- **No critical path** and no automatic rescheduling.
- The Gantt and calendar are **read-only** (no dragging); dates change in the cronograma.
- Milestones belong to the organization, not to one project; a task "must be done before" its day.
- Times of day aren't tracked; a day is the smallest unit.

## Phase 5: Materials and inventory ✖ (dropped 2026-10-27)
The product owner doesn't want a stock catalogue, locations, movements or reservations. Each
subproject keeps its simple materials list from Phase 3.

## Between phases
- [x] ORG-01 (2026-10-27): admins and production managers create organizations, e.g. one per
  festival, and switch between them (D-033).

## Phases 6–9 ⬜
See blueprint § 6. They are broken down into backlog items when the next one is chosen.
