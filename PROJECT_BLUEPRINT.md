# Production Management Platform --- Project Blueprint

## Purpose

Build a web-based production/project management platform for festivals,
events, construction, decoration, scenic design, workshops, and related
production work.

The product is inspired by the clarity and flexibility of tools such as
Monday.com, but it must have its own domain model and workflows. Do not
clone Monday's branding, layout, or proprietary features.

The application must let a production manager create and manage
everything through the Web UI. Users must never need to edit code, SQL,
or database records manually for normal operations.

## How to use this document

This file is the main product brief and phased implementation plan for
Codex or Claude Code.

1.  Put this file in the repository root as `PROJECT_BLUEPRINT.md`.
2.  Ask the coding agent to read it and create the project instruction
    file appropriate to the tool:
    -   Claude Code: `CLAUDE.md`
3.  Ask the agent to complete Phase 0 first. Do not ask it to build the
    entire product in one giant operation.
4.  Work phase by phase. After each phase, review the changes, run the
    tests, and verify the app locally before continuing.
5.  Keep this document updated when product decisions change.

------------------------------------------------------------------------

# 1. Product vision

Build a responsive web application that combines:

-   Hierarchical project and subproject management.
-   Tasks, subtasks, teams, owners, dates, dependencies, and progress.
-   Materials, stock, reservations, consumption, returns, waste, and
    reuse across projects.
-   Budgets, estimates, purchasing, and actual costs.
-   Configurable dashboards, charts, and reports.
-   Custom fields, statuses, views, templates, and project structures.
-   Mobile-friendly operation at production sites.
-   Role-based access for organizations and external collaborators.

The application should work well on desktop, tablet, and mobile. Plan
for Progressive Web App (PWA) installation later, but do not build a
native desktop/mobile app in the MVP.

## Core example

A festival contains a main project called **Main Stage**. It contains
multiple independent subprojects:

-   Stage structure --- owned by a construction company.
-   Shade sail --- owned by a designer/fabricator.
-   DJ area --- owned by Fernanda.
-   Bamboo structure --- owned by a separate team.
-   Sewing and textile finishes --- owned by a sewing team.

Each subproject has its own schedule, owner, team, tasks, materials,
costs, files, and progress. The overall production manager can see the
whole Main Stage project, while each owner can manage their own area.
Dependencies can cross subproject boundaries; for example, installing
the shade sail may depend on the stage structure being complete.

Support as many nested project levels as needed. Avoid hardcoding a
fixed hierarchy such as project → subproject → task only.

------------------------------------------------------------------------

# 2. Product principles

1.  **UI-first operations:** everyday users create, edit, assign, and
    report through the web interface.
2.  **One source of truth:** all views and dashboards read from the same
    underlying data.
3.  **Configurable, not hardcoded:** users can configure fields,
    statuses, views, and templates without code changes.
4.  **Secure by default:** private projects and organization data are
    never public unless explicitly configured.
5.  **Small, testable increments:** implement and verify one phase at a
    time.
6.  **Maintainable code:** prefer clear modules and simple abstractions
    over premature complexity.
7.  **Accessible and responsive:** keyboard-friendly forms, readable
    contrast, clear states, and usable mobile layouts.
8.  **Real calculations:** progress, stock, and budget metrics must come
    from defined rules and persisted data, not decorative hardcoded
    values.
9.  **Traceability:** important changes to tasks, dates, stock, and
    costs should be auditable.
10. **No fake completion:** do not claim a feature works until it is
    implemented and tested.

------------------------------------------------------------------------

# 3. Recommended initial stack

Use the following unless a technical blocker is found. Explain any
proposed change before making a major stack substitution.

-   **Frontend/full-stack framework:** Next.js with React and
    TypeScript.
-   **Styling/components:** Tailwind CSS and shadcn/ui, or an equivalent
    accessible component system.
-   **Database:** PostgreSQL.
-   **Backend/auth/storage:** Supabase, including Supabase Auth,
    database, Storage, and Row Level Security (RLS).
-   **Charts:** Apache ECharts or Recharts; choose one for the first
    release.
-   **Forms and validation:** a consistent form library and schema
    validation such as Zod.
-   **Testing:** unit tests for business rules, integration tests for
    database/security behavior, and browser-level smoke tests for
    critical flows.
-   **Version control:** Git.
-   **Hosting:** Vercel or a comparable host for the web application;
    Supabase hosted project for database/auth/storage.
-   **Deployment workflow:** separate local development,
    preview/staging, and production environments.

Use the package manager already present in the repository. If starting
from scratch, choose one package manager and document it; do not mix
npm, pnpm, and yarn.

Do not commit secrets. Use environment variables and provide a
`.env.example` containing placeholder values only.

------------------------------------------------------------------------

# 4. Initial domain model

Design and document the schema before implementing many UI screens.
Expect the schema to evolve through migrations.

## Main entities

-   `organizations`: companies or production teams using the platform.
-   `profiles`: user profile details associated with authenticated
    accounts.
-   `organization_members`: organization membership and
    organization-level role.
-   `projects`: project records with a nullable `parent_project_id`
    referencing another project.
-   `project_members`: users assigned to a project, with
    project-specific role where needed.
-   `tasks`: task records with a project reference and optional
    `parent_task_id` for subtasks.
-   `task_assignees`: users assigned to tasks.
-   `task_dependencies`: dependency relationships between tasks, with
    validation to prevent cycles.
-   `materials`: central material catalogue, units of measure, SKU/code,
    description, and optional default cost.
-   `stock_locations`: warehouses, workshops, vehicles, site stores, or
    other locations.
-   `material_movements`: auditable stock entries, issues, returns,
    transfers, adjustments, and waste.
-   `material_allocations`: quantities requested/reserved for a project
    or task.
-   `suppliers`: suppliers and contact details where appropriate.
-   `purchase_items` or a suitable purchasing model: expected purchases
    and actual purchasing costs.
-   `budgets` and `expenses`: planned amounts and actual costs, with
    currency and category.
-   `files` or metadata linked to Supabase Storage: drawings, photos,
    documents, and evidence.
-   `custom_field_definitions`: user-defined fields and their
    type/configuration.
-   `custom_field_values`: values for custom fields associated with
    supported records.
-   `status_definitions`: configurable statuses scoped to an
    organization or project template.
-   `project_templates`: reusable project structures and default
    configuration.
-   `activity_log`: important changes and actor/timestamp details.
-   `dashboard_definitions` and `dashboard_widgets`: configurable
    dashboard layouts, introduced after core data flows are stable.

These names are suggestions, not a reason to overcomplicate the first
migration. Start with the smallest coherent schema that supports the
current phase and evolve through migrations.

## Important data rules

-   Every organization-owned record must be scoped to an organization,
    directly or through a securely validated parent relationship.
-   A project may have a parent project. Enforce that parent and child
    belong to the same organization.
-   Tasks belong to a project and may have subtasks.
-   Tasks can depend on tasks in other projects, but only within an
    authorized organization unless cross-organization collaboration is
    deliberately designed later.
-   A material catalogue item is not the same as a stock balance.
-   Stock changes must be represented by auditable movements; do not let
    arbitrary edits silently overwrite stock history.
-   Reservations are different from consumption. A reservation reduces
    available stock but does not necessarily reduce physical on-hand
    stock.
-   Quantities must use appropriate decimal precision and units of
    measure.
-   Monetary values must use decimal/numeric types, not floating point.
    Store currency explicitly.
-   Store timestamps consistently and display them in the user's
    selected timezone.
-   Use soft deletion/archive where it protects audit history, and
    document deletion behavior.
-   Do not expose service-role credentials to the browser.

## Progress calculation

Do not use an unexplained simple average across all projects.

Implement a documented initial rule, for example: - Task progress is
manually entered from 0--100, or derived from status if the organization
chooses that rule. - Parent task/project progress is calculated from
eligible children using a configurable weighting rule. - Possible
weighting methods: equal weight, estimated effort, budget, or
manager-defined weight. - Show which method is being used and handle
empty projects explicitly. - Do not count the same work twice when
aggregating nested levels.

The first release may use one well-documented default weighting method,
with configurability added later.

------------------------------------------------------------------------

# 5. MVP scope

The first usable release should include:

1.  Authentication and organizations.
2.  Organization-level membership and basic roles.
3.  Projects with nested subprojects.
4.  Tasks and subtasks.
5.  Owners, assignees, statuses, priorities, start/due dates,
    description, and progress.
6.  Table and Kanban views.
7.  Project/task detail pages with editable forms.
8.  A basic project dashboard with genuine calculated metrics.
9.  A simple central material catalogue.
10. Material requests/reservations linked to projects/tasks.
11. Stock movements for receiving, issuing, returning, and adjusting
    materials.
12. Basic budget fields and cost summaries.
13. Responsive layouts.
14. Tests, deployment instructions, and safe environment configuration.

Defer advanced offline sync, complex procurement, AI estimation, native
apps, accounting integrations, and a fully free-form no-code builder
until the core workflow is proven.

------------------------------------------------------------------------

# 6. Phased roadmap and acceptance criteria

## Phase 0 --- Inspect, plan, and prepare

Tasks: - Inspect the current repository and installed tooling. - If the
repository is empty, scaffold the app. - Create `AGENTS.md` for Codex or
`CLAUDE.md` for Claude Code. - Create `README.md`, `.env.example`, and
`docs/` structure. - Write `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`,
and `docs/ROADMAP.md`. - Create a backlog of small implementation tasks
with clear acceptance criteria. - Identify unresolved product decisions,
but do not block progress on nonessential questions.

Acceptance: - The repository has clear setup instructions. - The
architecture and initial data model are documented. - The agent has not
silently implemented the entire product at once. - The app can be run
locally if the scaffold is included in this phase.

## Phase 1 --- App shell and design system

Build: - Responsive app shell with sidebar/navigation and top bar. -
Login, logout, loading, empty, error, and unauthorized states. - Design
tokens for spacing, typography, borders, colors, and status
indicators. - Reusable form fields, dialogs, tables, badges, buttons,
and toast feedback. - Basic routes for dashboard, projects, materials,
reports, and settings.

Acceptance: - Consistent visual language on desktop and mobile. -
Navigation works. - No key screens rely on static mock values presented
as real metrics. - Accessibility and responsive behavior are checked.

## Phase 2 --- Database, authentication, and authorization

Build: - Supabase setup and migrations. - Authentication and profiles. -
Organization creation and membership. - Basic roles: organization admin,
production manager, project owner, team member, and optional external
collaborator. - Row Level Security policies and secure server-side
access. - Seed/demo data for local testing.

Acceptance: - Unauthenticated users cannot access private data. - Users
in one organization cannot read or modify another organization's
records. - Role permissions are tested. - No service-role key or private
secret is present in client code or committed files.

## Phase 3 --- Project hierarchy and task management

Build: - Create/edit/archive projects and nested subprojects. - Project
owners and members. - Create/edit/archive tasks and subtasks. - Assign
users, statuses, priorities, dates, descriptions, and progress. - Table
and Kanban views. - Project detail page showing children and task
summaries. - Search, filters, sorting, and pagination where needed.

Acceptance: - A production manager can create a Main Stage project, then
create the Stage Structure, Shade Sail, DJ Area, and Sewing subprojects
through the UI. - Each subproject can have its own tasks and owner. -
Editing data persists after refresh. - Parent project summaries reflect
child records according to documented rules.

## Phase 4 --- Scheduling and dependencies

Build: - Calendar view and a Gantt view using a suitable maintained
library. - Task start/end dates, milestones, and dependency links. -
Dependency validation and cycle prevention. - Warnings for overdue tasks
and blocked work. - Cross-subproject dependencies. - A clear distinction
between planned and actual dates if actual dates are added.

Acceptance: - A task can depend on work in another subproject. - Invalid
dependency cycles are rejected. - Changes persist and affect relevant
views. - The parent project dashboard identifies important schedule
risks without pretending to calculate a critical path if that feature is
not implemented.

## Phase 5 --- Materials and inventory

Build: - Material catalogue with unit of measure. - Stock locations. -
Stock receiving, issuing, return, transfer, adjustment, and waste
records. - Material requests/reservations linked to tasks and
projects. - Available, reserved, on-hand, and consumed quantity views. -
Low-stock and shortage indicators. - Material cost estimates and actual
cost capture where appropriate.

Acceptance: - A manager can request 12 plywood sheets for a DJ task
through the UI. - The app shows whether the required quantity is
available. - Reserving stock changes available quantity correctly. -
Issuing/consuming stock creates an auditable movement. - Concurrent
stock changes cannot silently cause invalid negative stock. - Shared
inventory can be allocated across different projects.

## Phase 6 --- Budgets, analytics, and reports

Build: - Project and task budgets. - Planned versus actual cost
summaries. - Dashboard cards and charts for progress, task status,
overdue tasks, materials, and costs. - Donut charts for meaningful
categories. - Click-through filtering: selecting a chart segment opens
the corresponding records. - Date-range and project filters. - Export
selected reports to CSV first; add PDF/XLSX where justified. - Clearly
label estimated versus actual values and display the underlying
calculation method.

Acceptance: - All charts use real data from the database. - Totals
reconcile with underlying records. - Empty states and zero denominators
are handled correctly. - Report exports respect user permissions. - No
private data leaks through public routes or shared links.

## Phase 7 --- Customization and templates

Build after core workflows are stable: - Custom field definitions with
supported field types. - Configurable statuses and priorities. -
Reusable project/task templates. - Saved views and filters. - Dashboard
widget configuration. - Validation and compatibility rules for field
types.

Acceptance: - An authorized manager can add a custom field from the UI
without a code or database change. - The field value persists and
appears in the configured forms/views. - Field definitions and values
are scoped to the correct organization. - Unsupported field types are
not silently accepted.

## Phase 8 --- PWA and field operations

Build: - PWA manifest and installability. - Mobile-friendly task updates
and material transactions. - Photo/file attachments. - Optional
QR/barcode scanning if useful. - Evaluate offline requirements with real
users. - If offline writes are implemented, design explicit sync and
conflict behavior rather than pretending data is synchronized.

Acceptance: - Core mobile workflows are usable at a production site. -
File access is permission-checked. - Offline behavior is documented and
tested if implemented.

## Phase 9 --- Production hardening and launch

Build/check: - Error monitoring and structured logs. - Database backups
and restore procedure. - Rate limiting and abuse protection where
appropriate. - Security review of RLS policies and server actions/API
routes. - Dependency and build checks. - Accessibility and browser
tests. - Staging deployment and test data. - Production environment
variables and domain setup. - Privacy policy, terms, retention, and
account deletion processes appropriate to the intended market.

Acceptance: - CI/build/lint/tests pass. - Backup and restore procedure
is documented and tested. - Production secrets are stored securely. -
Staging has been tested before production release. - No known critical
authorization or data-isolation bug remains.

------------------------------------------------------------------------

# 7. UI and UX requirements

Use a clean, modern, information-dense interface inspired by good
project management products, without copying another product's branding
or proprietary design.

## Global navigation

-   Overview/dashboard.
-   Projects.
-   Tasks or work queue.
-   Materials/inventory.
-   Reports.
-   Team.
-   Settings.

## Project page

-   Project name, status, owner, date range, and progress.
-   Child projects and tasks.
-   Views: overview, table, Kanban, timeline/Gantt, materials, costs,
    files.
-   Search/filter and clear create buttons.
-   Progress and cost summaries with drill-down.

## Task detail page or drawer

-   Title, description, status, priority.
-   Parent project/subproject and parent task where applicable.
-   Owner and assignees.
-   Start date, due date, actual dates where supported.
-   Progress and estimate/actual effort where supported.
-   Dependencies and blockers.
-   Required materials and reservations.
-   Costs and supplier/purchase references.
-   Attachments, photos, comments/notes, and activity history.
-   Custom fields.

## UX rules

-   Users should be able to create/edit records without leaving the
    relevant context where practical.
-   Use clear save feedback and validation errors.
-   Confirm destructive actions.
-   Use archive instead of destructive deletion when records are part of
    audit history.
-   Provide useful empty states that explain the next action.
-   Keep filters and sorting predictable.
-   Make dashboard charts clickable where useful.
-   Never use color alone to convey status.
-   Use mock data only for clearly labelled demos; do not mix it with
    production metrics.

------------------------------------------------------------------------

# 8. Security and access model

The website may be publicly reachable on the Internet, but private
project data must require authentication and authorization.

Required principles: - Invite-only access initially; public
self-registration can be a later configurable option. -
Organization-level data isolation. - Project-level access restrictions
where needed. - Server-side authorization for sensitive operations. -
Supabase Row Level Security for organization-owned data. - Storage
bucket policies for project files and attachments. - Least privilege for
roles. - Secure password/session handling through the auth provider. -
No private secrets in client bundles, Git, screenshots, or logs. -
Export and report endpoints must enforce the same access rules as normal
pages. - Audit important stock, cost, permission, and scheduling
changes. - Treat external suppliers/contractors as limited-access users
if invited.

Never assume hiding a UI button is sufficient security.

------------------------------------------------------------------------

# 9. Development workflow for Codex or Claude Code

At the beginning of each session: 1. Read this blueprint and the repo
instruction file. 2. Inspect current Git status and recent changes. 3.
Inspect relevant code before editing. 4. Identify the current phase and
its acceptance criteria. 5. Make a short plan for the current task only.
6. Implement a small, coherent increment. 7. Run the relevant lint,
type-check, tests, and build. 8. Fix failures caused by the changes. 9.
Update documentation and mark progress in `docs/ROADMAP.md`. 10. Report
what changed, which checks passed, what remains, and exact commands to
run locally.

General rules: - Do not rewrite large parts of the application without a
clear reason. - Do not replace working functionality with mock data. -
Do not add dependencies without explaining why they are needed. - Do not
skip database migrations or tests for business-critical behavior. - Do
not claim a test passed unless it was actually run. - Do not expose
secrets. - Ask before destructive operations, production changes,
billing changes, or irreversible data migrations. - Prefer sensible
defaults for noncritical details rather than blocking on repeated
questions. - Keep changes small enough to review. - If blocked by
missing credentials, implement the non-secret-dependent work and
document the exact setup needed. - Maintain `docs/DECISIONS.md` for
important architectural/product decisions.

------------------------------------------------------------------------

# 10. Deployment plan

## Local development

-   Run the app on the developer's computer.
-   Use a dedicated development Supabase project or local Supabase
    setup.
-   Keep `.env.local` untracked.
-   Use seed data for development and tests.

## Preview/staging

-   Deploy a preview environment for testing each significant feature.
-   Use a separate Supabase project from production where possible.
-   Never use real confidential production data in preview.
-   Test sign-in, invitations, permissions, uploads, reports, and RLS.

## Production

-   Host the web app on Vercel or equivalent.
-   Use a managed PostgreSQL/Supabase project.
-   Configure a custom domain and HTTPS.
-   Set production environment variables in the hosting dashboard.
-   Configure database backups, monitoring, and a restore process.
-   Invite users rather than making project data public.
-   Test role-based access with multiple test accounts before inviting
    real teams.

## Environment variables

Create `.env.example` with variable names and placeholder values only.
For Supabase, document the required project URL and public/anonymous
key, plus any server-only secret if a feature truly requires it. Never
put a service-role key in a `NEXT_PUBLIC_` variable or browser code.

------------------------------------------------------------------------

# 11. First prompt to give the coding agent

Copy the following prompt into Codex or Claude Code from the root of the
repository:

> You are the lead engineer for this project. Read
> `PROJECT_BLUEPRINT.md` fully before making changes.
>
> Start with Phase 0 only. Inspect the repository, determine whether it
> is empty or already contains code, and create the project instruction
> file appropriate to this tool (`AGENTS.md` for Codex or `CLAUDE.md`
> for Claude Code). Create or update the architecture, data model,
> roadmap, and setup documentation.
>
> If the repository is empty, scaffold the smallest useful Next.js +
> TypeScript application using the stack in the blueprint. If it already
> contains code, preserve existing functionality and adapt the plan to
> the current structure.
>
> Do not attempt to implement every feature in this turn. Establish a
> clear, phased backlog with acceptance criteria. Identify the first
> vertical slice that can be built and tested end-to-end.
>
> Follow the blueprint's security requirements from the start,
> especially organization isolation and database authorization. Do not
> commit secrets or use production data.
>
> Run the checks available in the repository and report what was
> actually verified. Finish by explaining how I run the app locally,
> what files were created, and the exact next prompt I should use for
> Phase 1.

------------------------------------------------------------------------

# 12. Follow-up prompts for each phase

Use one prompt at a time. Review the changes before moving on.

## Phase 1

"Implement Phase 1 from `PROJECT_BLUEPRINT.md`: build the responsive app
shell, navigation, design system, and empty/loading/error states. Use
realistic demo data only where clearly labelled. Do not start later
phases. Run lint, type-check, tests, and build; report actual results."

## Phase 2

"Implement Phase 2 from `PROJECT_BLUEPRINT.md`: database migrations,
authentication, organizations, memberships, roles, and RLS policies.
Include tests proving that users cannot access another organization's
data. Do not weaken security to make a test pass."

## Phase 3

"Implement Phase 3 from `PROJECT_BLUEPRINT.md`: projects with nested
subprojects, tasks/subtasks, owners, assignees, statuses, dates,
progress, table view, and Kanban view. All CRUD operations must work
through the Web UI and persist to the database."

## Phase 4

"Implement Phase 4 from `PROJECT_BLUEPRINT.md`: calendar/Gantt,
milestones, cross-project task dependencies, cycle prevention, and
overdue/blocker indicators. Document limitations and test dependency
behavior."

## Phase 5

"Implement Phase 5 from `PROJECT_BLUEPRINT.md`: central material
catalogue, stock locations, auditable stock movements, reservations,
consumption, returns, shortages, and material links to projects/tasks.
Add tests for stock calculations and concurrent/invalid operations."

## Phase 6

"Implement Phase 6 from `PROJECT_BLUEPRINT.md`: dashboards, donut
charts, schedule/progress/material/cost metrics, drill-down filters, and
CSV exports. Use persisted data, document every metric's calculation,
and test totals."

## Phase 7

"Implement Phase 7 from `PROJECT_BLUEPRINT.md`: custom field definitions
and values, configurable statuses, templates, saved views, and dashboard
widgets. Authorized users must be able to configure fields through the
UI without changing code or database schema."

## Phase 8

"Implement Phase 8 from `PROJECT_BLUEPRINT.md`: improve mobile workflows
and add PWA support. Assess offline requirements before implementing
offline writes; document sync and conflict handling if offline mutation
is supported."

## Phase 9

"Run a production-readiness review against Phase 9 of
`PROJECT_BLUEPRINT.md`. Audit authorization/RLS, environment variables,
file access, exports, logs, backups, accessibility, tests, and
deployment documentation. Fix critical issues that can be safely fixed
in this environment and list anything requiring my credentials or
decision."

------------------------------------------------------------------------

# 13. Definition of a successful first release

The MVP is successful when a production manager can:

1.  Create an organization and invite team members.
2.  Create a festival project and multiple nested subprojects.
3.  Assign a different owner and team to each subproject.
4.  Create tasks and subtasks with dates, statuses, progress, and
    dependencies.
5.  Link materials to tasks, reserve stock, record consumption, and see
    shortages.
6.  See overall project progress and understand how it is calculated.
7.  Review schedule risks and basic budget/actual costs.
8.  Use a dashboard and export a report.
9.  Perform these actions through the Web UI without editing the
    database.
10. Be confident that other organizations and unauthorized users cannot
    access private data.

Do not expand scope until these workflows are reliable with realistic
test data.
