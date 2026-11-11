-- D-033, D-004 · Anyone signed in starts a workspace (organization) and becomes its admin.
-- One rolled-back transaction; fictional people only.
--
-- Cast: org A = Alice (admin), Paula (production manager), Carol (member), Eve (external);
-- Nina belongs to no organization.

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function pg_temp.sign_in(person text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = person || '@example.test'), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.sign_out() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p || '@example.test'
from unnest(array['alice', 'paula', 'carol', 'eve', 'nina']) as p;

create temp table ids (org_a uuid);
grant select on ids to authenticated;
insert into ids values (public.create_organization('Org A', 'org-a', (select id from auth.users where email = 'alice@example.test')));
insert into public.organization_members (organization_id, user_id, role)
select org_a, (select id from auth.users where email = p || '@example.test'), r
from ids, (values ('paula', 'production_manager'), ('carol', 'member'), ('eve', 'external')) as v(p, r);

select pg_temp.sign_in('paula');
select lives_ok($$ select public.create_my_organization('Summer Fest', 'summer-fest') $$,
  'a production manager starts a second festival');
select is((select role from public.organization_members m join public.organizations o on o.id = m.organization_id
           where o.slug = 'summer-fest'), 'admin', 'and is its admin');
select is((select count(*)::int from public.organization_members m join public.organizations o on o.id = m.organization_id
           where o.slug = 'summer-fest'), 1, 'nobody else is in it');
select is((select count(*)::int from public.organizations), 2, 'Paula now sees both organizations');
select throws_ok($$ select public.create_my_organization('Copy', 'org-a') $$,
  '23505', null, 'an address that is taken is refused');
select throws_ok($$ select public.create_my_organization('Bad', 'Not A Slug!') $$,
  '23514', null, 'an address must be lowercase letters, digits and hyphens');
select throws_ok($$ select public.create_my_organization('Clash', 'login') $$,
  '23514', null, 'an address that is an app page is refused');
select throws_ok($$ select public.create_my_organization('   ', 'blank-name') $$,
  '23514', null, 'an organization needs a name');

select pg_temp.sign_in('alice');
select lives_ok($$ select public.create_my_organization('Winter Fest', 'winter-fest') $$, 'an admin can too');
select is_empty($$ select 1 from public.organizations where slug = 'summer-fest' $$,
  'Alice does not see Paula''s new organization');

select pg_temp.sign_in('carol');
select lives_ok($$ select public.create_my_organization('Mine', 'carol-fest') $$,
  'a member can create a workspace too (single-user app, D-004)');

select pg_temp.sign_in('eve');
select lives_ok($$ select public.create_my_organization('Mine', 'eve-fest') $$,
  'so can any other role');

select pg_temp.sign_in('nina');
select lives_ok($$ select public.create_my_organization('Mine', 'nina-fest') $$,
  'and someone in no workspace yet, e.g. on first use');

select pg_temp.sign_out();
select throws_ok($$ select public.create_my_organization('Anon', 'anon-fest') $$,
  '42501', null, 'signed out, nobody can');

select * from finish();
rollback;
