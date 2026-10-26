-- P4-01 · Task links (D-027): "successor task starts after predecessor task finishes",
-- between any two tasks of the organization, also across subprojects and projects
-- (e.g. Rig sail waits for Set up structure, while Sew sail runs in parallel).
-- Nothing moves automatically: the app reports overlaps in red (D-019).

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  predecessor_task_id uuid not null,
  successor_task_id uuid not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (predecessor_task_id <> successor_task_id),
  unique (predecessor_task_id, successor_task_id),
  -- Both tasks belong to the link's organization.
  foreign key (organization_id, predecessor_task_id) references public.tasks (organization_id, id) on delete cascade,
  foreign key (organization_id, successor_task_id) references public.tasks (organization_id, id) on delete cascade
);
comment on table public.task_dependencies is 'Task waits for another task (any subproject or project of the organization). Overlaps are reported, never auto-moved.';

create index task_dependencies_successor_idx on public.task_dependencies (successor_task_id);
create index task_dependencies_predecessor_idx on public.task_dependencies (predecessor_task_id);

alter table public.task_dependencies enable row level security;

-- Refuse links inside one subproject (its tasks already run in order) and circles
-- (A waits for B waits for … A). The organization-wide lock makes two concurrent inserts
-- check one after the other, so together they can't create a circle.
create function private.check_task_dependency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('task_dependencies:' || new.organization_id::text, 0));

  if (select subproject_id from public.tasks where id = new.predecessor_task_id)
     = (select subproject_id from public.tasks where id = new.successor_task_id) then
    raise exception 'same_subproject' using errcode = '23514',
      hint = 'Tasks in one subproject already run one after another.';
  end if;

  if exists (
    with recursive downstream(id) as (
      select successor_task_id from public.task_dependencies where predecessor_task_id = new.successor_task_id
      union
      select d.successor_task_id
      from public.task_dependencies d
      join downstream on d.predecessor_task_id = downstream.id
    )
    select 1 from downstream where id = new.predecessor_task_id
  ) then
    raise exception 'task_dependency_cycle' using errcode = '23514',
      hint = 'This link would make tasks wait for each other in a circle.';
  end if;
  return new;
end;
$$;
revoke all on function private.check_task_dependency() from public, anon, authenticated;

create trigger task_dependencies_check
  before insert on public.task_dependencies
  for each row execute function private.check_task_dependency();

revoke all on public.task_dependencies from anon, authenticated;
grant select on public.task_dependencies to authenticated;
grant insert (organization_id, predecessor_task_id, successor_task_id) on public.task_dependencies to authenticated;
grant delete on public.task_dependencies to authenticated;

create policy "task links: members read" on public.task_dependencies for select to authenticated
  using (private.can_view_projects(organization_id));
create policy "task links: editors create" on public.task_dependencies for insert to authenticated
  with check (private.can_edit_projects(organization_id));
create policy "task links: editors remove" on public.task_dependencies for delete to authenticated
  using (private.can_edit_projects(organization_id));
