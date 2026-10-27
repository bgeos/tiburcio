-- P4-05 · Milestones (D-030): key dates of the organization, like "Festival opens" or
-- "Build-up deadline". Shown in every project. A task can be linked to a milestone: it must be
-- done before that day. Nothing moves automatically; a task that runs into it is shown in red.

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  date date not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
comment on table public.milestones is 'Key dates of the organization, shown in every project. Tasks linked to one must be done before it.';

create index milestones_organization_date_idx on public.milestones (organization_id, date);

create trigger milestones_updated_at
  before update on public.milestones
  for each row execute function private.set_updated_at();

-- "This task must be done before this milestone." Both in the link's organization.
create table public.task_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null,
  milestone_id uuid not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (task_id, milestone_id),
  foreign key (organization_id, task_id) references public.tasks (organization_id, id) on delete cascade,
  foreign key (organization_id, milestone_id) references public.milestones (organization_id, id) on delete cascade
);
comment on table public.task_milestones is 'Task must be done before the milestone''s day. Misses are reported in red, never auto-moved.';

create index task_milestones_milestone_idx on public.task_milestones (milestone_id);

alter table public.milestones enable row level security;
alter table public.task_milestones enable row level security;

revoke all on public.milestones, public.task_milestones from anon, authenticated;
grant select, delete on public.milestones, public.task_milestones to authenticated;
grant insert (organization_id, name, date) on public.milestones to authenticated;
grant update (name, date) on public.milestones to authenticated;
grant insert (organization_id, task_id, milestone_id) on public.task_milestones to authenticated;

create policy "milestones: members read" on public.milestones for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "milestones: editors create" on public.milestones for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "milestones: editors update" on public.milestones for update to authenticated
  using (private.can_edit_projects(organization_id))
  with check (private.can_edit_projects(organization_id));
create policy "milestones: editors delete" on public.milestones for delete to authenticated
  using (private.can_edit_projects(organization_id));

create policy "milestone links: members read" on public.task_milestones for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "milestone links: editors create" on public.task_milestones for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "milestone links: editors remove" on public.task_milestones for delete to authenticated
  using (private.can_edit_projects(organization_id));
