-- P2-04/P2-05 · Organization isolation and role limits (RLS) for the Phase 2 tables.
-- Runs with `npm run test:db` (pgTAP). Everything happens in one transaction that is
-- rolled back, so it never changes local data. All people are fictional.
--
-- Cast: org A = Alice (admin), Dan (production manager), Carol (member), Eve (external)
--       org B = Bob (admin)        no organization = Frank

begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Helpers -------------------------------------------------------------------
-- Sign in as one of the cast: sets the JWT claims, then switches to the API role.
create function pg_temp.sign_in(person text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = person || '@example.test'), 'role', 'authenticated')::text,
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

-- Fixtures (as postgres) ------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p || '@example.test'
from unnest(array['alice', 'bob', 'carol', 'dan', 'eve', 'frank']) as p;

create temp table ids as
select
  (select id from auth.users where email = 'alice@example.test') as alice,
  (select id from auth.users where email = 'bob@example.test') as bob,
  (select id from auth.users where email = 'carol@example.test') as carol,
  (select id from auth.users where email = 'dan@example.test') as dan,
  (select id from auth.users where email = 'eve@example.test') as eve,
  (select id from auth.users where email = 'frank@example.test') as frank;
grant select on ids to authenticated;

alter table ids add column org_a uuid, add column org_b uuid;
update ids set org_a = public.create_organization('Org A', 'org-a', alice),
               org_b = public.create_organization('Org B', 'org-b', bob);

insert into public.organization_members (organization_id, user_id, role)
select org_a, dan, 'production_manager' from ids
union all select org_a, carol, 'member' from ids
union all select org_a, eve, 'external' from ids;

-- Structure -----------------------------------------------------------------
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has row level security enabled'
);
select is(
  (select count(*) from public.profiles where id in (select unnest(array[alice, bob, carol, dan, eve, frank]) from ids)),
  6::bigint,
  'a profile is created for every new auth user'
);

select throws_ok(
  $$ select public.create_organization('Clash', 'no-organization', (select alice from ids)) $$,
  '23514', null, 'organization addresses cannot use reserved route names');

-- Signed out (anon) -----------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.organizations $$, '42501', null, 'anon cannot read organizations');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.organization_members $$, '42501', null, 'anon cannot read members');
reset role;

-- Alice: admin of A -----------------------------------------------------------
select pg_temp.sign_in('alice');
select results_eq($$ select slug from public.organizations $$, array['org-a'], 'admin sees only her own organization');
select is_empty($$ select 1 from public.organization_members where organization_id = (select org_b from ids) $$,
  'admin cannot read another organization''s members');
select is_empty($$ update public.organizations set name = 'Hacked' where id = (select org_b from ids) returning 1 $$,
  'admin cannot rename another organization');
select is_empty($$ delete from public.organization_members where organization_id = (select org_b from ids) returning 1 $$,
  'admin cannot remove another organization''s members');
select throws_ok(
  $$ insert into public.invitations (organization_id, email, role, token_hash)
     values ((select org_b from ids), 'x@example.test', 'member', repeat('a', 64)) $$,
  '42501', null, 'admin cannot invite into another organization');
select throws_ok(
  $$ insert into public.invitations (organization_id, email, role, token_hash, invited_by)
     values ((select org_a from ids), 'x@example.test', 'member', repeat('a', 64), (select bob from ids)) $$,
  '42501', null, 'nobody can set invited_by to someone else');
select lives_ok(
  $$ insert into public.invitations (organization_id, email, role, token_hash)
     values ((select org_a from ids), 'new.admin@example.test', 'admin', repeat('b', 64)) $$,
  'admin can invite any role into her organization');
select throws_ok($$ update public.organizations set slug = 'renamed' where id = (select org_a from ids) $$,
  '42501', null, 'the organization address (slug) cannot be changed by users');
select lives_ok($$ update public.organizations set name = 'Org A Renamed' where id = (select org_a from ids) $$,
  'admin can rename her organization');
select throws_ok($$ select public.create_organization('Mine', 'mine', (select alice from ids)) $$,
  '42501', null, 'signed-in users cannot create organizations (invitation-only)');
select throws_ok($$ delete from public.organization_members where user_id = (select alice from ids) $$,
  'P0001', 'An organization must keep at least one admin.', 'the last admin cannot leave');
select throws_ok(
  $$ update public.organization_members set role = 'member' where user_id = (select alice from ids) $$,
  'P0001', 'An organization must keep at least one admin.', 'the last admin cannot be demoted');
select throws_ok(
  $$ update public.organization_members set organization_id = (select org_b from ids) where user_id = (select carol from ids) $$,
  '42501', null, 'a membership cannot be moved to another organization');
select lives_ok(
  $$ update public.organization_members set role = 'admin' where user_id = (select dan from ids) $$,
  'admin can promote a member');
select lives_ok($$ delete from public.organization_members where user_id = (select alice from ids) $$,
  'an admin can leave once another admin exists');

-- Dan is now A's only admin, so first Alice rejoins as admin, then Dan goes back to
-- production manager (demoting him first would trip the last-admin guard).
select pg_temp.sign_out();
insert into public.organization_members (organization_id, user_id, role) select org_a, alice, 'admin' from ids;
update public.organization_members set role = 'production_manager' where user_id = (select dan from ids);

select pg_temp.sign_in('dan');
select throws_ok(
  $$ insert into public.invitations (organization_id, email, role, token_hash)
     values ((select org_a from ids), 'boss@example.test', 'admin', repeat('c', 64)) $$,
  '42501', null, 'production manager cannot invite an admin');
select lives_ok(
  $$ insert into public.invitations (organization_id, email, role, token_hash)
     values ((select org_a from ids), 'helper@example.test', 'external', repeat('d', 64)) $$,
  'production manager can invite an external collaborator');
select is_empty($$ update public.organization_members set role = 'member' where user_id = (select eve from ids) returning 1 $$,
  'production manager cannot change roles');
select lives_ok($$ update public.invitations set revoked_at = now() where email = 'helper@example.test' $$,
  'production manager can revoke an invitation they may send');
select throws_ok($$ update public.invitations set revoked_at = null where email = 'helper@example.test' $$,
  '42501', null, 'a revoked invitation cannot be reopened');

-- Carol: member of A ------------------------------------------------------------
select pg_temp.sign_in('carol');
select is((select count(*) from public.organization_members), 4::bigint, 'member sees the members of her organization');
select is((select count(*) from public.invitations), 0::bigint, 'member cannot see invitations');
select is_empty($$ update public.organization_members set role = 'admin' where user_id = (select carol from ids) returning 1 $$,
  'member cannot promote herself');
select throws_ok(
  $$ insert into public.invitations (organization_id, email, role, token_hash)
     values ((select org_a from ids), 'friend@example.test', 'member', repeat('e', 64)) $$,
  '42501', null, 'member cannot invite');
select is_empty($$ update public.profiles set full_name = 'Not me' where id = (select dan from ids) returning 1 $$,
  'nobody can edit someone else''s profile');
select lives_ok($$ update public.profiles set full_name = 'Carol Example' where id = (select carol from ids) $$,
  'people can edit their own profile');

-- Eve: external in A ----------------------------------------------------------------
select pg_temp.sign_in('eve');
select is((select count(*) from public.organization_members), 1::bigint, 'external sees only her own membership');
select is((select count(*) from public.profiles), 1::bigint, 'external sees only her own profile');

-- Frank: no organization --------------------------------------------------------------
select pg_temp.sign_in('frank');
select is_empty($$ select 1 from public.organizations $$, 'a user without membership sees no organizations');
select is_empty($$ select 1 from public.organization_members $$, 'a user without membership sees no members');

-- Bob: admin of B -------------------------------------------------------------------
select pg_temp.sign_in('bob');
select is_empty($$ select 1 from public.profiles where id = (select carol from ids) $$,
  'people in other organizations are invisible');

select pg_temp.sign_out();
select is((select count(*) from public.organization_members where organization_id = (select org_a from ids)), 4::bigint,
  'org A still has its members after all the cross-organization attempts');

select * from finish();
rollback;
