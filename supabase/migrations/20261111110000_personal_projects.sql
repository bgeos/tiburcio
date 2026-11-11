-- Plan § 5 · Personal projects: Bruno's own projects (DIY, career, family…), outside any
-- jupigenio workspace (D-004). Tasks, notes, materials and files arrive in Phase 3.
-- Owner-only: no organization, so policies check user_id alone.

create table public.personal_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  category text not null default 'other'
    check (category in ('build', 'diy', 'career', 'family', 'garage', 'other')),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'idea' check (status in ('idea', 'active', 'paused', 'done')),
  icon text not null default '' check (char_length(icon) <= 40),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);
comment on table public.personal_projects is 'Bruno''s personal projects (plan § 5). Visible only to their owner.';

create index personal_projects_user_idx on public.personal_projects (user_id, sort_order);

create trigger personal_projects_updated_at
  before update on public.personal_projects
  for each row execute function private.set_updated_at();

alter table public.personal_projects enable row level security;

revoke all on public.personal_projects from anon, authenticated;
grant select, delete on public.personal_projects to authenticated;
grant insert (name, slug, category, description, status, icon, sort_order) on public.personal_projects to authenticated;
grant update (name, slug, category, description, status, icon, sort_order, archived_at) on public.personal_projects to authenticated;

create policy "personal projects: owner reads" on public.personal_projects for select to authenticated
  using (user_id = (select auth.uid()));
create policy "personal projects: owner creates" on public.personal_projects for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "personal projects: owner updates" on public.personal_projects for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "personal projects: owner deletes" on public.personal_projects for delete to authenticated
  using (user_id = (select auth.uid()));
