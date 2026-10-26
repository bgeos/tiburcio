-- P2-03 · Identity and tenancy: profiles, organizations, members, invitations.
-- See docs/DATA_MODEL.md (Phase 2), docs/ARCHITECTURE.md (Security model, Roles),
-- D-003 (RLS is the authorization boundary), D-021 (invitation-only accounts).
--
-- Rules followed here:
-- * RLS is enabled on every table in this migration, with its policies.
-- * Policy helpers live in schema `private`, which the Data API does not expose.
--   They are SECURITY DEFINER with an empty search_path (no RLS recursion, no
--   search_path hijacking) and only answer questions about the calling user.
-- * `anon` gets nothing. `authenticated` gets only the columns it may change.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by trigger
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_path text,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Public profile of an auth user. Created by trigger on auth.users insert.';

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Users that existed before this migration.
insert into public.profiles (id, full_name)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 120)
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  -- Used in URLs: /<slug>/projects (D-016). Lowercase letters, digits, single hyphens.
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 50)
    -- Top-level routes and words that must never be an organization address.
    check (slug not in (
      'api', 'auth', 'login', 'logout', 'signup', 'sign-up', 'invite', 'accept-invite',
      'design', 'admin', 'static', 'public', 'new', 'settings', 'dashboard', 'projects',
      'tasks', 'materials', 'reports', 'team', 'help', 'about'
    )),
  default_currency char(3) not null default 'BRL' check (default_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'America/Sao_Paulo',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'production_manager', 'member', 'external')),
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members (user_id);

alter table public.organization_members enable row level security;

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function private.set_updated_at();

-- An organization must always keep at least one admin.
create function private.keep_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role <> 'admin' or (tg_op = 'UPDATE' and new.role = 'admin') then
    return coalesce(new, old);
  end if;
  -- Serialise admin changes per organization so two admins can't remove each other
  -- concurrently. If the organization itself is being deleted, allow the cascade.
  perform 1 from public.organizations where id = old.organization_id for update;
  if not found then
    return old;
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = old.organization_id
      and role = 'admin'
      and user_id <> old.user_id
  ) then
    raise exception 'An organization must keep at least one admin.'
      using errcode = 'P0001', hint = 'Make another member admin first.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger organization_members_keep_last_admin
  before update of role or delete on public.organization_members
  for each row execute function private.keep_last_admin();

-- ---------------------------------------------------------------------------
-- invitations (accepting one is a SECURITY DEFINER function, added with P2-08)
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null check (role in ('admin', 'production_manager', 'member', 'external')),
  -- SHA-256 (hex) of the token sent by email; the token itself is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default now() + interval '7 days',
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
-- One open invitation per person per organization.
create unique index invitations_one_open_per_email
  on public.invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.invitations enable row level security;

-- ---------------------------------------------------------------------------
-- Policy helpers (about the calling user only)
-- ---------------------------------------------------------------------------
create function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = (select auth.uid())
  );
$$;

create function private.has_org_role(org_id uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = (select auth.uid())
      and role = any (roles)
  );
$$;

-- Non-external members can see the profiles of people in their organizations.
create function private.can_see_profile(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members them on them.organization_id = me.organization_id
    where me.user_id = (select auth.uid())
      and me.role <> 'external'
      and them.user_id = profile_id
  );
$$;

revoke all on function private.is_org_member(uuid), private.has_org_role(uuid, text[]),
  private.can_see_profile(uuid) from public, anon;
grant execute on function private.is_org_member(uuid), private.has_org_role(uuid, text[]),
  private.can_see_profile(uuid) to authenticated, service_role;
revoke all on function private.set_updated_at(), private.handle_new_user(),
  private.keep_last_admin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges: nothing for anon; only the needed columns for authenticated
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.organizations, public.organization_members,
  public.invitations from anon, authenticated;

grant select on public.profiles, public.organizations, public.organization_members,
  public.invitations to authenticated;
grant update (full_name, avatar_path, timezone, locale) on public.profiles to authenticated;
-- The slug is the organization's address; changing it would break links (operator only).
grant update (name, default_currency, timezone) on public.organizations to authenticated;
grant update (role) on public.organization_members to authenticated;
grant delete on public.organization_members to authenticated;
grant insert (organization_id, email, role, token_hash, expires_at) on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- profiles
create policy "profiles: read own and co-members"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.can_see_profile(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations: no insert/delete for users (D-021: created by an operator).
create policy "organizations: members read"
  on public.organizations for select to authenticated
  using (private.is_org_member(id));

create policy "organizations: admins update"
  on public.organizations for update to authenticated
  using (private.has_org_role(id, array['admin']))
  with check (private.has_org_role(id, array['admin']));

-- organization_members: rows are created only by accepting an invitation (P2-08)
-- or by the operator function below.
create policy "members: read own row, or all rows unless external"
  on public.organization_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(organization_id, array['admin', 'production_manager', 'member'])
  );

create policy "members: admins change roles"
  on public.organization_members for update to authenticated
  using (private.has_org_role(organization_id, array['admin']))
  with check (private.has_org_role(organization_id, array['admin']));

create policy "members: admins remove members, anyone can leave"
  on public.organization_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(organization_id, array['admin'])
  );

-- invitations: admins invite any role; production managers invite members and externals.
create policy "invitations: admins and production managers read"
  on public.invitations for select to authenticated
  using (private.has_org_role(organization_id, array['admin', 'production_manager']));

create policy "invitations: admins and production managers create"
  on public.invitations for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and accepted_at is null
    and revoked_at is null
    and (
      private.has_org_role(organization_id, array['admin'])
      or (
        private.has_org_role(organization_id, array['production_manager'])
        and role in ('member', 'external')
      )
    )
  );

create policy "invitations: admins and production managers revoke"
  on public.invitations for update to authenticated
  using (
    accepted_at is null
    and (
      private.has_org_role(organization_id, array['admin'])
      or (
        private.has_org_role(organization_id, array['production_manager'])
        and role in ('member', 'external')
      )
    )
  )
  with check (
    revoked_at is not null
    and (
      private.has_org_role(organization_id, array['admin'])
      or (
        private.has_org_role(organization_id, array['production_manager'])
        and role in ('member', 'external')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Operator-only: create an organization with its first admin (D-021).
-- Not callable by signed-in users; run with the secret key or as postgres.
-- ---------------------------------------------------------------------------
create function public.create_organization(org_name text, org_slug text, admin_user_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_org_id uuid;
begin
  if not exists (select 1 from public.profiles where id = admin_user_id) then
    raise exception 'No user with id %', admin_user_id using errcode = 'P0002';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (btrim(org_name), lower(btrim(org_slug)), admin_user_id)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, admin_user_id, 'admin');

  return new_org_id;
end;
$$;

revoke all on function public.create_organization(text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_organization(text, text, uuid) to service_role;
