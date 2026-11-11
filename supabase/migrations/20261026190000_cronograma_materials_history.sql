-- P3-12 · Tasks (cronograma), subproject materials, dependencies between subprojects,
-- the locked plan (baseline) and the history log (D-019, D-025; DATA_MODEL § Phase 3).
-- Same access rule as P3-11: read = admin/PM/member, write = admin/PM, external = nothing.

-- Dependencies must stay inside one project: let them reference (project_id, id).
alter table public.subprojects add constraint subprojects_project_id_id_key unique (project_id, id);

-- ---------------------------------------------------------------------------
-- tasks: run one after another from the subproject's start (computed, not stored)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  subproject_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  duration_days integer not null check (duration_days between 1 and 3650),
  -- Wait before starting (e.g. a late delivery), in calendar days.
  delay_days integer not null default 0 check (delay_days between 0 and 3650),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  progress numeric(5, 2) check (progress between 0 and 100),
  actual_start date,
  actual_end date,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (actual_end is null or actual_start is null or actual_end >= actual_start),
  unique (organization_id, id),
  foreign key (organization_id, subproject_id) references public.subprojects (organization_id, id) on delete cascade
);
create index tasks_subproject_id_idx on public.tasks (subproject_id, sort_order);

alter table public.tasks enable row level security;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- subproject_materials: what a subproject needs (not the Phase 5 stock catalogue)
-- ---------------------------------------------------------------------------
create table public.subproject_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  subproject_id uuid not null,
  description text not null check (char_length(btrim(description)) between 1 and 300),
  status text not null default 'to_request'
    check (status in ('to_request', 'requested', 'ready_at_warehouse', 'on_site')),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, subproject_id) references public.subprojects (organization_id, id) on delete cascade
);
create index subproject_materials_subproject_id_idx on public.subproject_materials (subproject_id, sort_order);
create index subproject_materials_organization_id_idx on public.subproject_materials (organization_id);

alter table public.subproject_materials enable row level security;

create trigger subproject_materials_set_updated_at
  before update on public.subproject_materials
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- subproject_dependencies: "successor starts after predecessor finishes".
-- Nothing moves automatically; the app reports overlaps.
-- ---------------------------------------------------------------------------
create table public.subproject_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  predecessor_id uuid not null,
  successor_id uuid not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (predecessor_id <> successor_id),
  unique (predecessor_id, successor_id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  -- Both ends in the same project (and therefore the same organization).
  foreign key (project_id, predecessor_id) references public.subprojects (project_id, id) on delete cascade,
  foreign key (project_id, successor_id) references public.subprojects (project_id, id) on delete cascade
);
create index subproject_dependencies_project_id_idx on public.subproject_dependencies (project_id);

alter table public.subproject_dependencies enable row level security;

-- Refuse cycles (A after B after … after A). Locks the project so two concurrent
-- inserts can't each pass the check and create a cycle together.
create function private.prevent_dependency_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.projects where id = new.project_id for update;
  if exists (
    with recursive downstream(id) as (
      select successor_id from public.subproject_dependencies where predecessor_id = new.successor_id
      union
      select d.successor_id
      from public.subproject_dependencies d
      join downstream on d.predecessor_id = downstream.id
    )
    select 1 from downstream where id = new.predecessor_id
  ) then
    raise exception 'dependency_cycle' using errcode = '23514', hint = 'This link would make subprojects wait for each other in a circle.';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_dependency_cycle() from public, anon, authenticated;

create trigger subproject_dependencies_prevent_cycle
  before insert on public.subproject_dependencies
  for each row execute function private.prevent_dependency_cycle();

-- ---------------------------------------------------------------------------
-- plan_baselines: the locked ("original") plan, one per project
-- ---------------------------------------------------------------------------
create table public.plan_baselines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null unique,
  -- { "<subproject or task id>": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } }
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  locked_at timestamptz not null default now(),
  locked_by uuid references public.profiles (id) on delete set null,
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);

alter table public.plan_baselines enable row level security;

-- Who locked it and when are stamped by the database, never taken from the client.
create function private.stamp_plan_baseline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.locked_at := now();
  new.locked_by := (select auth.uid());
  return new;
end;
$$;
revoke all on function private.stamp_plan_baseline() from public, anon, authenticated;

create trigger plan_baselines_stamp
  before insert or update on public.plan_baselines
  for each row execute function private.stamp_plan_baseline();

-- ---------------------------------------------------------------------------
-- activity_log: append-only history ("what changed, and why")
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  subproject_id uuid,
  actor_id uuid default auth.uid() references public.profiles (id) on delete set null,
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  -- Lines such as "Assemble poles: 7 Jan – 10 Jan → 8 Jan – 11 Jan".
  details jsonb not null default '[]' check (jsonb_typeof(details) = 'array'),
  reason text check (char_length(reason) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (project_id, subproject_id) references public.subprojects (project_id, id) on delete cascade
);
create index activity_log_project_id_idx on public.activity_log (project_id, created_at desc);
create index activity_log_subproject_id_idx on public.activity_log (subproject_id, created_at desc);

alter table public.activity_log enable row level security;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on public.tasks, public.subproject_materials, public.subproject_dependencies,
  public.plan_baselines, public.activity_log from anon, authenticated;

grant select on public.tasks, public.subproject_materials, public.subproject_dependencies,
  public.plan_baselines, public.activity_log to authenticated;

grant insert (organization_id, subproject_id, name, duration_days, delay_days, status, progress,
  actual_start, actual_end, sort_order) on public.tasks to authenticated;
grant update (name, duration_days, delay_days, status, progress, actual_start, actual_end,
  sort_order, archived_at) on public.tasks to authenticated;

grant insert (organization_id, subproject_id, description, status, sort_order) on public.subproject_materials to authenticated;
grant update (description, status, sort_order, archived_at) on public.subproject_materials to authenticated;

-- A dependency is a link: added or removed (both logged in activity_log), never edited.
grant insert (organization_id, project_id, predecessor_id, successor_id) on public.subproject_dependencies to authenticated;
grant delete on public.subproject_dependencies to authenticated;

grant insert (organization_id, project_id, snapshot) on public.plan_baselines to authenticated;
grant update (snapshot) on public.plan_baselines to authenticated;

-- Append-only: insert, never update or delete. actor_id and created_at come from defaults.
grant insert (organization_id, project_id, subproject_id, summary, details, reason) on public.activity_log to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy "tasks: members read" on public.tasks for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "tasks: editors create" on public.tasks for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "tasks: editors update" on public.tasks for update to authenticated
  using (private.can_edit_projects(organization_id))
  with check (private.can_edit_projects(organization_id));

create policy "materials: members read" on public.subproject_materials for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "materials: editors create" on public.subproject_materials for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "materials: editors update" on public.subproject_materials for update to authenticated
  using (private.can_edit_projects(organization_id))
  with check (private.can_edit_projects(organization_id));

create policy "dependencies: members read" on public.subproject_dependencies for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "dependencies: editors create" on public.subproject_dependencies for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "dependencies: editors remove" on public.subproject_dependencies for delete to authenticated
  using (private.can_edit_projects(organization_id));

create policy "baselines: members read" on public.plan_baselines for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "baselines: editors lock" on public.plan_baselines for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "baselines: editors re-lock" on public.plan_baselines for update to authenticated
  using (private.can_edit_projects(organization_id))
  with check (private.can_edit_projects(organization_id));

create policy "history: members read" on public.activity_log for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "history: editors write their own entries" on public.activity_log for insert to authenticated
  with check (private.can_edit_projects(organization_id) and actor_id = (select auth.uid()));
