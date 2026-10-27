-- D-033 · Admins and production managers can start a new organization (e.g. a second
-- festival) from the app, and become its first admin. Amends D-021: accounts are still
-- invitation-only; only the "operator creates every organization" part changes.
-- Non-destructive: adds one function; tables and policies are unchanged.

create function public.create_my_organization(org_name text, org_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  new_org_id uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  -- Allowed when the person is an admin or production manager somewhere already.
  if not exists (
    select 1 from public.organization_members
    where user_id = me and role in ('admin', 'production_manager')
  ) then
    raise exception 'Only admins and production managers can create organizations' using errcode = '42501';
  end if;

  -- Name and address rules (and a taken address) are enforced by the table's checks.
  insert into public.organizations (name, slug, created_by)
  values (btrim(org_name), lower(btrim(org_slug)), me)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, me, 'admin');

  return new_org_id;
end;
$$;

revoke all on function public.create_my_organization(text, text) from public, anon;
grant execute on function public.create_my_organization(text, text) to authenticated, service_role;
