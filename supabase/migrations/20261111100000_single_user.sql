-- D-003 / D-004 · Tibúrcio is a single-user app; jupigenio's organizations are Bruno's
-- workspaces (one per job). Nobody else joins, so invitations go, and creating a workspace
-- no longer needs an existing admin role.
-- Destructive for invitations only: the tiburcio project has never held any.

drop function public.accept_invitation(text);
drop function public.invitation_preview(text);
drop table public.invitations;

-- Any signed-in person may start a workspace and becomes its admin and only member.
-- Sign-up is off, so the only signed-in person is the owner.
create or replace function public.create_my_organization(org_name text, org_slug text)
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

  -- Name and address rules (and a taken address) are enforced by the table's checks.
  insert into public.organizations (name, slug, created_by)
  values (btrim(org_name), lower(btrim(org_slug)), me)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, me, 'admin');

  return new_org_id;
end;
$$;
