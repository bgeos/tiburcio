# Data model

Status: Phase 2 identity/tenancy tables are **implemented**
(`supabase/migrations/20261026154738_identity_and_tenancy.sql`); later sections are design.
Tables are created phase by phase through `supabase/migrations/`, and this document is
updated in the same change.

## Conventions

- Primary keys: `id uuid primary key default gen_random_uuid()`.
- Every organization-owned table has `organization_id uuid not null` (denormalized
  on purpose), so RLS policies are a simple membership check.
- **Same-org integrity:** child→parent references are composite foreign keys
  `(organization_id, parent_id) references parent(organization_id, id)`.
  Parents therefore declare `unique (organization_id, id)`. The database itself
  then guarantees that a subproject, task, dependency or allocation can never point
  into another organization.
- Timestamps: `timestamptz`, stored in UTC, with `created_at` / `updated_at`
  (updated by a trigger) and `created_by uuid references auth.users`.
  Display uses the user's timezone from `profiles.timezone`.
- Dates without times (start/due) use `date`.
- Money: `numeric(14,2)` with `currency char(3)` (ISO 4217). Never float.
- Quantities: `numeric(14,3)` with a unit taken from the material.
- Soft delete: `archived_at timestamptz null`. Default queries exclude archived rows.
  Hard delete is allowed only for records with no audit significance.
- RLS is enabled in the **same migration** that creates the table.
- Enumerations that users will configure later (statuses) are tables, not Postgres enums.
  Fixed system values (roles, movement types) are `text` with a `check` constraint.

## Entity overview

```
organizations ─┬─ organization_members ── profiles (1:1 auth.users)
               ├─ projects ── plan_baselines, activity_log            (Phase 3, D-025)
               │     └─ subprojects ── subproject_dependencies (within a project)
               │           ├─ tasks              (cronograma: sequential, durations)
               │           │     └─ task_dependencies (any two tasks of the org, P4-01)
               │           ├─ subproject_materials
               │           └─ crew_members       (owner = one of them)
               ├─ materials ── material_movements ── stock_locations
               │       └──── material_allocations (→ project / task)
               ├─ suppliers, purchase_items
               ├─ budgets, expenses
               ├─ files (Storage metadata)
               ├─ custom_field_definitions ── custom_field_values
               ├─ project_templates
               ├─ dashboard_definitions ── dashboard_widgets
               └─ activity_log
```

## Phase 2: identity and tenancy

### `profiles`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | = `auth.users.id`, created by trigger on sign-up |
| full_name | text | |
| avatar_path | text null | Storage path |
| timezone | text | IANA, default `'UTC'` |
| locale | text | default `'en'` |

### `organizations`
| column | type | notes |
| --- | --- | --- |
| id | uuid PK | |
| name | text | |
| slug | text unique | used in URLs |
| default_currency | char(3) | e.g. `BRL` |
| timezone | text | default for new members |

Created only through `public.create_organization(name, slug, admin_user_id)`, which
inserts the org and its first `admin` in one transaction. It is **operator-only**
(executable by `service_role` only, D-021). The `slug` is the URL segment (D-016):
lowercase letters, digits and single hyphens, 2–50 characters, not a reserved route name.
Admins can change `name`, `default_currency` and `timezone`; the slug is operator-only.

### `organization_members`
`(organization_id, user_id)` unique, plus `role text check (role in ('admin','production_manager','member','external'))`,
`invited_by`, `joined_at`. An org must always keep at least one admin (enforced by trigger).

### `invitations`
`organization_id`, `email` (lowercase), `role`, `token_hash` (SHA-256 hex; the token is never
stored), `expires_at` (default 7 days), `invited_by` (= the caller), `accepted_at`,
`accepted_by`, `revoked_at`. At most one open invitation per email per org.
Readable by org admins and production managers. Admins invite any role; production
managers invite `member`/`external` only. Revoking sets `revoked_at` (it can't be undone).
Accepting goes through `public.accept_invitation(token)` (`security definer`): it hashes the
token, locks the row, and refuses unknown, revoked, used or expired invitations and any
caller whose email differs from the invited one; then it adds the membership (an existing
member keeps their role) and marks the invitation accepted. `public.invitation_preview(token)`
returns the organization, role, email and status for the accept page. Both need a signed-in caller.

`profiles.email` (P2-08) mirrors `auth.users.email` (trigger on insert and email change) so
co-members can see each other's email on the Team page; it is not user-editable.

### Privileges and helpers (implemented)
- `anon` has no access to these tables. `authenticated` can update only specific columns
  (column grants), so keys such as `organization_id` or `user_id` can never be changed.
- Members are added only by accepting an invitation (P2-08) or by `create_organization`.
  Admins change roles and remove members; anyone can leave. Externals see only their own
  membership row and only their own profile.
- Policy helpers `private.is_org_member`, `private.has_org_role`, `private.can_see_profile`
  live in the `private` schema (not exposed by the Data API).

## Phase 3: projects, subprojects and the cronograma (D-019/D-025)

Implemented: `projects`, `subprojects`, `crew_members` (P3-11); `tasks`, `subproject_materials`,
`subproject_dependencies`, `plan_baselines`, `activity_log` (P3-12). The database stamps
`plan_baselines.locked_by/locked_at` and `activity_log.actor_id`; dependency cycles are refused
by a trigger that locks the project row.

One level only: a **project** (e.g. Main Stage) has **subprojects** (Structure, Shade Sail…).
Every table has `organization_id`, `created_at`/`updated_at`, `created_by`, `archived_at`
(soft delete: archived rows are hidden but kept for history) and RLS:
**read** = org `admin`, `production_manager`, `member`; **write** = `admin`, `production_manager`;
`external` sees nothing yet. Child rows use composite same-org foreign keys.

### `projects`
`name` (1–120), `description` (optional), `status text check in ('planning','active','finished')`,
`sort_order`.

### `subprojects`
`project_id`, `name`, `start_date date not null`, `owner_crew_id uuid null` (→ `crew_members`
of the **same subproject**, checked by trigger), `sort_order`.
Its end date is not stored: it is the end of its last task (`lib/domain/schedule.ts`).

### `crew_members`
`subproject_id`, `name` (1–120), `role` (free text, e.g. "Rigger"), `sort_order`.
Crew are people on site, not app users (no sign-in). Daily cost comes later.

### `tasks`
`subproject_id`, `name`, `duration_days int check (>= 1)`, `delay_days int default 0 check (>= 0)`
(wait before starting, e.g. a late delivery), `status text check in ('todo','in_progress','blocked','done')`,
`progress numeric(5,2) null check (0–100)`, `actual_start date`, `actual_end date`, `sort_order`.
Tasks run one after another from the subproject's start date in `sort_order`; planned dates
are computed, not stored (start day counts as day 1, calendar days).

### `subproject_materials`
`subproject_id`, `description` (free text, e.g. "Steel cable, 8 mm"),
`status text check in ('to_request','requested','ready_at_warehouse','on_site')`, `sort_order`.
Not linked to the Phase 5 catalogue/stock yet.

### `subproject_dependencies`
`predecessor_id`, `successor_id` (subprojects of the **same project**; no self-links, no cycles).
Meaning: "successor starts after predecessor finishes". Nothing moves automatically: an
overlap is reported (in red) instead.

### `task_dependencies` (P4-01, D-027)
`predecessor_task_id`, `successor_task_id`: any two tasks of the **same organization**, also in
different subprojects or projects. Not inside one subproject (its tasks already run in order),
no self-links, no cycles (trigger, organization-wide advisory lock). Same meaning as subproject
links: nothing moves; an overlap is reported in red, with a preview before saving. Removed
links are deleted (the history keeps who removed what). Links to archived tasks are ignored.

### `personal_tasks` (P4-02, D-028)
"My tasks": `organization_id`, `user_id` (default `auth.uid()`), `name`, `description`,
`status` (`todo` / `in_progress` / `done`), `tag` (`todo` / `reminder`). Visible and editable
only by `user_id`, while a member of the organization (not even admins). Not linked to
projects; deleted, not archived.

### `plan_baselines`
One per project (`project_id` unique): `locked_at`, `locked_by`, `snapshot jsonb`
(`{ id: { start, end } }` for every subproject and task at lock time). "Lock plan" replaces it.

### `activity_log`
`project_id`, `subproject_id null`, `actor_id`, `summary`, `details jsonb` (lines such as
"Assemble poles: 7–10 Jan → 8–11 Jan"), `reason text null`, `created_at`. Append-only:
inserted with each change, never updated or deleted by users.

### Rules (see `lib/domain`)
- Progress: `rollupProgress` (D-007): each task counts equally, Done = 100, archived excluded.
- Overlaps: `findOverlaps` on dependencies, using computed dates.

## Phase 5: materials and inventory

- `materials`: `organization_id`, `code` (unique per org), `name`, `description`,
  `unit` (e.g. `sheet`, `m`, `m2`, `kg`, `pcs`), `default_unit_cost numeric(14,2)`,
  `currency`, `min_stock numeric(14,3)`, `archived_at`. **A catalogue item, not a balance.**
- `stock_locations`: warehouse, workshop, vehicle, site store… (`kind`, `name`).
- `material_movements`: **append-only ledger**. Columns: `material_id`, `type`
  (`receive|issue|return|transfer|adjust|waste`), `from_location_id`,
  `to_location_id`, `quantity numeric(14,3) > 0`, `unit_cost`, `currency`,
  `project_id`, `task_id`, `allocation_id`, `note`, `created_by`, `created_at`.
  No update or delete (RLS denies it). Corrections are new `adjust` movements.
- `stock_balances`: one row per (material, location) with `on_hand`, maintained
  only by the posting function. It is a performance cache of the ledger and can
  be rebuilt from it.
- `material_allocations`: request/reservation of a quantity for a project or task.
  `status (requested|reserved|partially_issued|issued|released|cancelled)`,
  `quantity_requested`, `quantity_reserved`, `quantity_issued`, `needed_by`.

**Quantities (per material, optionally per location):**
- `on_hand` = sum of ledger in − out.
- `reserved` = Σ (`quantity_reserved − quantity_issued`) of active allocations.
- `available` = `on_hand − reserved`.
- `consumed` = issued − returned, per project or task.

**Concurrency:** all stock changes go through `post_material_movement(...)`
and `reserve_material(...)` SQL functions. They `SELECT … FOR UPDATE` the
affected `stock_balances` rows, check `on_hand ≥ 0` and `available ≥ 0`, and
raise an error otherwise. Two simultaneous reservations therefore cannot oversell.
A `check (on_hand >= 0)` constraint is the final guard.

## Phase 6: budgets and costs

- `budgets`: `project_id` (or `task_id`), `category`, `amount numeric(14,2)`, `currency`.
- `expenses`: actual costs with `category`, `amount`, `currency`, `incurred_on`,
  `supplier_id`, `purchase_item_id`, optional `material_movement_id`.
- `suppliers`, `purchase_items` (expected purchases, status, expected/actual cost).
- Multi-currency: totals are shown per currency. No FX conversion in the MVP (see DECISIONS).

## Later phases

- `files`: Storage object metadata (`bucket`, `path`, `project_id`, `task_id`, `mime`, `size`). Phase 8.
- `custom_field_definitions` (`entity`, `key`, `label`, `type` from a fixed
  list, `config jsonb` validated per type) and `custom_field_values`
  (typed value columns rather than one text blob). Phase 7.
- `project_templates`, `dashboard_definitions`, `dashboard_widgets`. Phases 6–7.
- `activity_log`: `organization_id`, `entity`, `entity_id`, `action`, `actor_id`,
  `changes jsonb` (before/after for audited fields), `created_at`. Written by
  triggers. Introduced in Phase 3 for tasks/projects and extended afterwards.

## Progress calculation (default rule, v1)

Goal: one documented, non-double-counting rule. Configurable weighting comes later (Phase 7).

1. **Leaf task progress** (a task with no non-archived subtasks):
   - If its status category is `done`, progress is 100.
   - If its status category is `cancelled`, it is excluded from all roll-ups.
   - Otherwise the manual `progress` value applies (0–100), and null counts as 0.
2. **Parent task progress** = mean of its eligible leaf descendants.
3. **Project progress** = mean progress of **all eligible leaf tasks in the
   project and all its descendant projects** (each leaf counted exactly once,
   equal weight per leaf).
4. **Empty** (no eligible leaf tasks): progress is `null` and the UI shows
   "No tasks yet", never 0% or 100%.
5. The UI states the method: "Average of N tasks, equal weight".

Why equal weight per leaf rather than per child project: a 3-task DJ booth
should not count as much as a 200-task stage structure, and counting leaves
once avoids double-counting nested levels. Later options: weight by
`estimated_hours`, budget, or manager-defined weights (stored per project).
