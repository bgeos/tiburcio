-- P3-11 · Projects, subprojects and their crew (D-019, D-025; docs/DATA_MODEL.md § Phase 3).
--
-- Access (D-025): read = admin, production manager, member; write = admin, production
-- manager; external collaborators see nothing yet. Users never delete rows: they archive
-- them (archived_at), so history stays intact. Keys that place a row (organization,
-- project, subproject) can't be changed after creation (column grants).

-- ---------------------------------------------------------------------------
-- Access helpers (about the calling user only; same pattern as P2-03)
-- ---------------------------------------------------------------------------
create function private.can_view_projects(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(org_id, array['admin', 'production_manager', 'member']);
$$;

create function private.can_edit_projects(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(org_id, array['admin', 'production_manager']);
$$;

revoke all on function private.can_view_projects(uuid), private.can_edit_projects(uuid) from public, anon;
grant execute on function private.can_view_projects(uuid), private.can_edit_projects(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'planning' check (status in ('planning', 'active', 'finished')),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index projects_organization_id_idx on public.projects (organization_id);

alter table public.projects enable row level security;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- subprojects (one level: a project's areas, e.g. Structure, Shade Sail)
-- ---------------------------------------------------------------------------
create table public.subprojects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Tasks run one after another from here (lib/domain/schedule.ts).
  start_date date not null,
  -- One of this subproject's crew; the foreign key is added below, after crew_members.
  owner_crew_id uuid,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- Same-organization integrity: the project must be in the same organization.
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);
create index subprojects_project_id_idx on public.subprojects (project_id);

alter table public.subprojects enable row level security;

create trigger subprojects_set_updated_at
  before update on public.subprojects
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- crew_members (people on site, typed per subproject; not app users)
-- ---------------------------------------------------------------------------
create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  subproject_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  role text not null default '' check (char_length(role) <= 80),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (subproject_id, id),
  foreign key (organization_id, subproject_id) references public.subprojects (organization_id, id) on delete cascade
);
create index crew_members_subproject_id_idx on public.crew_members (subproject_id);

alter table public.crew_members enable row level security;

create trigger crew_members_set_updated_at
  before update on public.crew_members
  for each row execute function private.set_updated_at();

-- The owner must be crew of the SAME subproject: (id, owner_crew_id) → crew (subproject_id, id).
alter table public.subprojects
  add constraint subprojects_owner_is_own_crew
  foreign key (id, owner_crew_id) references public.crew_members (subproject_id, id)
  on delete set null (owner_crew_id);

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anon; no deletes; placement keys are insert-only
-- ---------------------------------------------------------------------------
revoke all on public.projects, public.subprojects, public.crew_members from anon, authenticated;

grant select on public.projects, public.subprojects, public.crew_members to authenticated;

grant insert (organization_id, name, description, status, sort_order) on public.projects to authenticated;
grant update (name, description, status, sort_order, archived_at) on public.projects to authenticated;

grant insert (organization_id, project_id, name, start_date, sort_order) on public.subprojects to authenticated;
grant update (name, start_date, owner_crew_id, sort_order, archived_at) on public.subprojects to authenticated;

grant insert (organization_id, subproject_id, name, role, sort_order) on public.crew_members to authenticated;
grant update (name, role, sort_order, archived_at) on public.crew_members to authenticated;

-- ---------------------------------------------------------------------------
-- Policies (the same rule for the three tables)
-- ---------------------------------------------------------------------------
create policy "projects: members read" on public.projects for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "projects: editors create" on public.projects for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "projects: editors update" on public.projects for update to authenticated
  using (private.can_edit_projects(organization_id))
  with check (private.can_edit_projects(organization_id));

create policy "subprojects: members read" on public.subprojects for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "subprojects: editors create" on public.subprojects for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "subprojects: editors update" on public.subprojects for update to authenticated
  using (private.can_edit_projects(organization_id))
  with check (private.can_edit_projects(organization_id));

create policy "crew: members read" on public.crew_members for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "crew: editors create" on public.crew_members for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "crew: editors update" on public.crew_members for update to authenticated
  using (private.can_edit_projects(organization_id))
  with check (private.can_edit_projects(organization_id));
