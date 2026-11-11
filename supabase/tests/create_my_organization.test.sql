-- D-033 · Admins and production managers start new organizations and become their admin.
-- One rolled-back transaction; fictional people only.
--
-- Cast: org A = Alice (admin), Paula (production manager), Carol (member), Eve (external);
-- Nina belongs to no organization.

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.sign_in(person text) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = person || '@example.test'), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
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
select throws_ok($$ select public.create_my_organization('Mine', 'carol-fest') $$,
  '42501', null, 'a member cannot create organizations');

select pg_temp.sign_in('eve');
select throws_ok($$ select public.create_my_organization('Mine', 'eve-fest') $$,
  '42501', null, 'an external collaborator cannot');

select pg_temp.sign_in('nina');
select throws_ok($$ select public.create_my_organization('Mine', 'nina-fest') $$,
  '42501', null, 'someone in no organization cannot');

select * from finish();
rollback;
