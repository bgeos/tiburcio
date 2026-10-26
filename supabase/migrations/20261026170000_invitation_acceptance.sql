-- P2-08 · Accepting invitations, and member emails on profiles.
-- See D-021 (invitation-only) and docs/DATA_MODEL.md § invitations.
--
-- Invitation tokens are never stored: invitations.token_hash = sha256(token) in hex.
-- Both functions below hash the token they receive and compare hashes.

-- ---------------------------------------------------------------------------
-- profiles.email: shown on the Team page. Kept in sync with auth.users; people
-- can't edit it here (no column grant), only through the auth email-change flow.
-- ---------------------------------------------------------------------------
alter table public.profiles add column email text;

update public.profiles p set email = lower(u.email) from auth.users u where u.id = p.id;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

-- ---------------------------------------------------------------------------
-- What an invitation link is for, so the accept page can say "Join X as Y".
-- Anyone signed in who holds the token may see it: the token was sent to the
-- invited person, and acceptance itself checks the email.
-- ---------------------------------------------------------------------------
create function public.invitation_preview(invite_token text)
returns table (organization_name text, organization_slug text, role text, email text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    o.slug,
    i.role,
    i.email,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'open'
    end
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = encode(sha256(convert_to(invite_token, 'UTF8')), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Accept: the only way (besides the operator command) to join an organization.
-- Errors use fixed messages the app turns into friendly text.
-- ---------------------------------------------------------------------------
create function public.accept_invitation(invite_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.invitations;
  caller uuid := (select auth.uid());
  caller_email text := lower((select auth.jwt()) ->> 'email');
  org_slug text;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  -- Lock the row so the same link can't be accepted twice concurrently.
  select * into invitation
  from public.invitations
  where token_hash = encode(sha256(convert_to(invite_token, 'UTF8')), 'hex')
  for update;

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  elsif invitation.revoked_at is not null then
    raise exception 'invitation_revoked' using errcode = 'P0001';
  elsif invitation.accepted_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  elsif invitation.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  elsif caller_email is distinct from invitation.email then
    raise exception 'invitation_wrong_account' using errcode = '42501';
  end if;

  -- Someone who is already a member keeps their current role.
  insert into public.organization_members (organization_id, user_id, role, invited_by)
  values (invitation.organization_id, caller, invitation.role, invitation.invited_by)
  on conflict (organization_id, user_id) do nothing;

  update public.invitations
  set accepted_at = now(), accepted_by = caller
  where id = invitation.id;

  select slug into org_slug from public.organizations where id = invitation.organization_id;
  return org_slug;
end;
$$;

revoke all on function public.invitation_preview(text), public.accept_invitation(text) from public, anon;
grant execute on function public.invitation_preview(text), public.accept_invitation(text) to authenticated;
