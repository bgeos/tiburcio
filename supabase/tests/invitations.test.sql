-- P2-08 · Accepting invitations (invitation_preview, accept_invitation) and profile emails.
-- One rolled-back transaction; fictional people only.
--
-- Cast: Alice = admin of org A. Nina = invited by email. Mallory = signed in, holds
-- Nina's link (e.g. a forwarded email) but is a different account.

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.sign_in(person text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', (select id from auth.users where email = person || '@example.test'),
      'email', person || '@example.test',
      'role', 'authenticated'
    )::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.sign_out() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function pg_temp.hash(token text) returns text language sql as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;

insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p || '@example.test'
from unnest(array['alice', 'nina', 'mallory']) as p;

create temp table t as
select public.create_organization('Org A', 'org-a', (select id from auth.users where email = 'alice@example.test')) as org_a,
       (select id from auth.users where email = 'nina@example.test') as nina;
grant select on t to authenticated;

-- Invitations (as postgres; creating them through RLS is covered in tenancy_rls.test.sql).
insert into public.invitations (organization_id, email, role, token_hash, invited_by, expires_at, created_at)
select org_a, 'nina@example.test', 'member', pg_temp.hash('open-token'),
       (select id from auth.users where email = 'alice@example.test'), now() + interval '7 days', now()
from t
union all
select org_a, 'late@example.test', 'member', pg_temp.hash('expired-token'), null, now() - interval '1 day', now() - interval '8 days'
from t;
insert into public.invitations (organization_id, email, role, token_hash, revoked_at)
select org_a, 'gone@example.test', 'member', pg_temp.hash('revoked-token'), now() from t;

-- Profiles get the account email --------------------------------------------------
select is((select email from public.profiles where id = (select id from auth.users where email = 'nina@example.test')),
  'nina@example.test', 'new profiles get the account email');
update auth.users set email = 'nina.new@example.test' where email = 'nina@example.test';
select is((select email from public.profiles where id = (select id from auth.users where email = 'nina.new@example.test')),
  'nina.new@example.test', 'profile email follows an email change');
update auth.users set email = 'nina@example.test' where email = 'nina.new@example.test';

-- Signed out ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.invitation_preview('open-token') $$, '42501', null,
  'signed-out visitors cannot look up invitations');
select throws_ok($$ select public.accept_invitation('open-token') $$, '42501', null,
  'signed-out visitors cannot accept invitations');
reset role;

-- Preview ------------------------------------------------------------------------------
select pg_temp.sign_in('nina');
select results_eq($$ select organization_name, role, status from public.invitation_preview('open-token') $$,
  $$ values ('Org A'::text, 'member'::text, 'open'::text) $$, 'the invited person sees what the link is for');
select is((select status from public.invitation_preview('expired-token')), 'expired', 'an old link shows as expired');
select is((select status from public.invitation_preview('revoked-token')), 'revoked', 'a revoked link shows as revoked');
select is_empty($$ select * from public.invitation_preview('made-up-token') $$, 'an unknown token reveals nothing');

-- Wrong account -------------------------------------------------------------------------
select pg_temp.sign_in('mallory');
select throws_ok($$ select public.accept_invitation('open-token') $$, '42501', 'invitation_wrong_account',
  'a link only works for the invited email address');

-- Expired / revoked / unknown -------------------------------------------------------------
select pg_temp.sign_in('nina');
select throws_ok($$ select public.accept_invitation('expired-token') $$, 'P0001', 'invitation_expired',
  'an expired link cannot be used');
select throws_ok($$ select public.accept_invitation('revoked-token') $$, 'P0001', 'invitation_revoked',
  'a revoked link cannot be used');
select throws_ok($$ select public.accept_invitation('made-up-token') $$, 'P0002', 'invitation_not_found',
  'an unknown token cannot be used');

-- Accept ---------------------------------------------------------------------------------
select is(public.accept_invitation('open-token'), 'org-a', 'the invited person joins and gets the organization address');
select is(
  (select role from public.organization_members where user_id = (select nina from t)),
  'member', 'they join with the invited role');
select results_eq($$ select slug from public.organizations $$, array['org-a'],
  'after joining, the organization is visible to them');
select throws_ok($$ select public.accept_invitation('open-token') $$, 'P0001', 'invitation_used',
  'a link works only once');

select * from finish();
rollback;
