-- D-028 · My tasks: a person's own to-dos and reminders inside an organization.
-- Private: only the person who wrote one sees or changes it (not even admins).
-- Not part of any project's plan or history, so removing one deletes it.

create table public.personal_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  tag text not null default 'todo' check (tag in ('todo', 'reminder')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.personal_tasks is 'A person''s own to-dos and reminders in an organization. Visible only to that person.';

create index personal_tasks_owner_idx on public.personal_tasks (organization_id, user_id);

create trigger personal_tasks_updated_at
  before update on public.personal_tasks
  for each row execute function private.set_updated_at();

alter table public.personal_tasks enable row level security;

revoke all on public.personal_tasks from anon, authenticated;
grant select, delete on public.personal_tasks to authenticated;
grant insert (organization_id, name, description, status, tag) on public.personal_tasks to authenticated;
grant update (name, description, status, tag) on public.personal_tasks to authenticated;

-- Own rows only, and only while a member of the organization.
create policy "my tasks: owner reads" on public.personal_tasks for select to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "my tasks: owner creates" on public.personal_tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "my tasks: owner updates" on public.personal_tasks for update to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id))
  with check (user_id = (select auth.uid()) and private.is_org_member(organization_id));
create policy "my tasks: owner deletes" on public.personal_tasks for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id));
