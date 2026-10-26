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
               ├─ projects ──(parent_project_id)──▶ projects        (any depth)
               │     ├─ project_members
               │     └─ tasks ──(parent_task_id)──▶ tasks            (subtasks)
               │           ├─ task_assignees
               │           └─ task_dependencies (task → task, any project in org)
               ├─ status_definitions
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

## Phase 3: projects and tasks

### `projects`
| column | type | notes |
| --- | --- | --- |
| id, organization_id | uuid | `unique (organization_id, id)` |
| parent_project_id | uuid null | composite FK to `projects(organization_id, id)` |
| name | text | |
| description | text | |
| owner_id | uuid null | profile; the subproject owner (e.g. "Fernanda" for DJ area) |
| status_id | uuid null | → `status_definitions` |
| start_date, due_date | date null | check `due_date >= start_date` |
| sort_order | int | ordering among siblings |
| archived_at | timestamptz null | |

- Any depth. Cycles are prevented by a trigger that walks ancestors on
  insert/update of `parent_project_id`.
- Archiving a project hides its descendants in default views but does not change their own
  `archived_at`.

### `project_members`
`(project_id, user_id)` unique, `role text check (role in ('owner','editor','viewer'))`,
plus `organization_id` for RLS. Membership applies to the project and its descendants.

### `status_definitions`
`organization_id`, `scope ('project'|'task')`, `name`, `color`,
`category text check (category in ('todo','in_progress','blocked','done','cancelled'))`,
`sort_order`. Seeded with defaults per new org. The **category** carries
meaning for calculations (e.g. `done`), and the name and colour are user-facing.

### `tasks`
| column | type | notes |
| --- | --- | --- |
| id, organization_id | uuid | `unique (organization_id, id)` |
| project_id | uuid | composite FK to `projects` |
| parent_task_id | uuid null | composite FK to `tasks`. Must be in the same project (trigger) |
| title, description | text | |
| status_id | uuid | → `status_definitions` (scope `task`) |
| priority | text | `check in ('low','medium','high','urgent')` |
| owner_id | uuid null | |
| start_date, due_date | date null | |
| actual_start, actual_end | date null | Phase 4 |
| is_milestone | bool | Phase 4 |
| progress | numeric(5,2) null | 0–100, manual. Only meaningful on leaf tasks |
| estimated_hours | numeric(8,2) null | for future effort weighting |
| sort_order | int | |
| archived_at | timestamptz null | |

### `task_assignees`
`(task_id, user_id)` unique, plus `organization_id`.

### `task_dependencies` (Phase 4)
`organization_id`, `predecessor_id`, `successor_id` (both composite FKs to
`tasks`, so tasks must be in the same org but can be in any project),
`type text default 'finish_to_start'`, `lag_days int default 0`.
Self-dependency and cycles are rejected by trigger (recursive CTE).

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
