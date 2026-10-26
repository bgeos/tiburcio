# Roadmap

Legend: ✅ done · 🟡 in progress · ⬜ not started. Detailed tasks are in [BACKLOG.md](BACKLOG.md).
Full acceptance criteria are in `PROJECT_BLUEPRINT.md` § 6.

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Inspect, plan, prepare | ✅ |
| 1 | App shell and design system | ✅ |
| 2 | Database, auth, authorization | 🟡 |
| 3 | Project hierarchy and tasks | ⬜ |
| 4 | Scheduling and dependencies | ⬜ |
| 5 | Materials and inventory | ⬜ |
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

## Phase 2: Database, auth, authorization 🟡
- [x] P2-01 local Supabase stack (2026-10-26).
- [x] P2-03 identity and tenancy tables with RLS (2026-10-26).
- [x] P2-04/05 database tests: org isolation and role limits, `npm run test:db` (2026-10-26).
- [x] P2-02/06 Supabase clients, proxy session refresh, sign in/out (2026-10-26).
- [x] P2-07 organization URLs `/[org]/…`, switcher, no-organization page, `org:create` (2026-10-26).
- [x] P2-08 invitations: invite, email/link, accept, revoke (2026-10-26).
Accept: unauthenticated users blocked, org isolation proved by tests, role
permissions tested, no secrets in client or Git. Backlog P2-*.

## Phase 3: Projects and tasks ⬜
Product shape agreed in D-019 (subproject = cronograma + materials + people). A clickable
prototype with demo data is at `/projects/prototype` (P3-00) for feedback before building.

Accept: Main Stage with 4 subprojects created via UI, each with its own owner and tasks,
edits persist, parent summaries follow the documented progress rule. Backlog P3-*.

## Phases 4–9 ⬜
See blueprint § 6. They are broken down into backlog items when the preceding phase is complete.
