-- P3-11 · Projects, subprojects and crew: organization isolation and role limits (D-025).
-- One rolled-back transaction; fictional people only.
--
-- Cast: org A = Alice (admin), Dan (production manager), Carol (member), Eve (external)
--       org B = Bob (admin)

begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

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
from unnest(array['alice', 'bob', 'carol', 'dan', 'eve']) as p;

create temp table ids (org_a uuid, org_b uuid, project_a uuid, project_b uuid, sub_a uuid, sub_a2 uuid, sub_b uuid, crew_a uuid, crew_a2 uuid);
grant select, update on ids to authenticated;
insert into ids (org_a, org_b) values (
  public.create_organization('Org A', 'org-a', (select id from auth.users where email = 'alice@example.test')),
  public.create_organization('Org B', 'org-b', (select id from auth.users where email = 'bob@example.test'))
);
insert into public.organization_members (organization_id, user_id, role)
select org_a, (select id from auth.users where email = p || '@example.test'), r
from ids, (values ('dan', 'production_manager'), ('carol', 'member'), ('eve', 'external')) as v(p, r);

-- Org B's project, created as postgres.
insert into public.projects (organization_id, name) select org_b, 'B Stage' from ids;
update ids set project_b = (select id from public.projects where name = 'B Stage');
insert into public.subprojects (organization_id, project_id, name, start_date) select org_b, project_b, 'B Area', '2027-01-04' from ids;
update ids set sub_b = (select id from public.subprojects where name = 'B Area');

-- Alice (admin) builds Main Stage ---------------------------------------------------
select pg_temp.sign_in('alice');
select lives_ok($$ insert into public.projects (organization_id, name, status) values ((select org_a from ids), 'Main Stage', 'active') $$,
  'admin can create a project');
select pg_temp.sign_out();
update ids set project_a = (select id from public.projects where name = 'Main Stage');
select pg_temp.sign_in('alice');

select lives_ok($$ insert into public.subprojects (organization_id, project_id, name, start_date)
  values ((select org_a from ids), (select project_a from ids), 'Structure', '2027-01-04'),
         ((select org_a from ids), (select project_a from ids), 'Shade Sail', '2027-01-14') $$,
  'admin can add subprojects');
select pg_temp.sign_out();
update ids set sub_a = (select id from public.subprojects where name = 'Structure'),
               sub_a2 = (select id from public.subprojects where name = 'Shade Sail');
select pg_temp.sign_in('alice');

select lives_ok($$ insert into public.crew_members (organization_id, subproject_id, name, role)
  values ((select org_a from ids), (select sub_a from ids), 'Tomás Ferraz', 'Lead'),
         ((select org_a from ids), (select sub_a2 from ids), 'Lúcia Andrade', 'Lead') $$,
  'admin can add crew');
select pg_temp.sign_out();
update ids set crew_a = (select id from public.crew_members where name = 'Tomás Ferraz'),
               crew_a2 = (select id from public.crew_members where name = 'Lúcia Andrade');
select pg_temp.sign_in('alice');

select lives_ok($$ update public.subprojects set owner_crew_id = (select crew_a from ids) where id = (select sub_a from ids) $$,
  'the owner can be one of the subproject''s crew');
select throws_ok($$ update public.subprojects set owner_crew_id = (select crew_a2 from ids) where id = (select sub_a from ids) $$,
  '23503', null, 'the owner cannot be crew of another subproject');
select throws_ok($$ insert into public.projects (organization_id, name) values ((select org_a from ids), '   ') $$,
  '23514', null, 'a project needs a name');
select throws_ok($$ insert into public.projects (organization_id, name, status) values ((select org_a from ids), 'X', 'paused') $$,
  '23514', null, 'project status is planning, active or finished');
select throws_ok($$ update public.subprojects set project_id = (select project_b from ids) where id = (select sub_a from ids) $$,
  '42501', null, 'a subproject cannot be moved to another project');
select throws_ok($$ update public.projects set organization_id = (select org_b from ids) where id = (select project_a from ids) $$,
  '42501', null, 'a project cannot be moved to another organization');
select throws_ok($$ delete from public.projects where id = (select project_a from ids) $$,
  '42501', null, 'projects are archived, never deleted');
select lives_ok($$ update public.crew_members set archived_at = now() where id = (select crew_a2 from ids) $$,
  'crew can be archived');

-- Cross-organization attempts by Alice
select is_empty($$ select 1 from public.projects where organization_id = (select org_b from ids) $$,
  'admin cannot see another organization''s projects');
select is_empty($$ update public.projects set name = 'Hacked' where id = (select project_b from ids) returning 1 $$,
  'admin cannot rename another organization''s project');
select throws_ok($$ insert into public.projects (organization_id, name) values ((select org_b from ids), 'Sneaky') $$,
  '42501', null, 'admin cannot create a project in another organization');
select throws_ok($$ insert into public.subprojects (organization_id, project_id, name, start_date)
  values ((select org_a from ids), (select project_b from ids), 'Sneaky', '2027-01-01') $$,
  '23503', null, 'a subproject cannot point at another organization''s project');
select throws_ok($$ insert into public.crew_members (organization_id, subproject_id, name)
  values ((select org_a from ids), (select sub_b from ids), 'Sneaky') $$,
  '23503', null, 'crew cannot be added to another organization''s subproject');

-- Dan (production manager) ----------------------------------------------------------
select pg_temp.sign_in('dan');
select lives_ok($$ update public.projects set description = 'Festival main stage' where id = (select project_a from ids) $$,
  'production manager can edit projects');
select lives_ok($$ insert into public.crew_members (organization_id, subproject_id, name, role)
  values ((select org_a from ids), (select sub_a from ids), 'Bia Santos', 'Carpenter') $$,
  'production manager can add crew');

-- Carol (member): read only ---------------------------------------------------------
select pg_temp.sign_in('carol');
select is((select count(*) from public.projects), 1::bigint, 'member sees the organization''s projects');
select is((select count(*) from public.subprojects), 2::bigint, 'member sees the subprojects');
select is((select count(*) from public.crew_members), 3::bigint, 'member sees the crew (archived included; the app hides them)');
select throws_ok($$ insert into public.projects (organization_id, name) values ((select org_a from ids), 'Mine') $$,
  '42501', null, 'member cannot create projects');
select is_empty($$ update public.projects set name = 'Renamed' where id = (select project_a from ids) returning 1 $$,
  'member cannot edit projects');
select is_empty($$ update public.subprojects set start_date = '2027-02-01' where id = (select sub_a from ids) returning 1 $$,
  'member cannot change dates');
select throws_ok($$ insert into public.crew_members (organization_id, subproject_id, name)
  values ((select org_a from ids), (select sub_a from ids), 'Extra') $$,
  '42501', null, 'member cannot add crew');

-- Eve (external): nothing yet ---------------------------------------------------------
select pg_temp.sign_in('eve');
select is_empty($$ select 1 from public.projects $$, 'external collaborators see no projects yet');
select is_empty($$ select 1 from public.crew_members $$, 'external collaborators see no crew');

-- Bob (other organization) ------------------------------------------------------------
select pg_temp.sign_in('bob');
select results_eq($$ select name from public.projects $$, array['B Stage'], 'each organization sees only its own projects');

-- Signed out ------------------------------------------------------------------------------
select pg_temp.sign_out();
set local role anon;
select throws_ok($$ select * from public.projects $$, '42501', null, 'signed-out visitors cannot read projects');
reset role;

select is((select name from public.projects where organization_id = (select org_a from ids)), 'Main Stage',
  'Main Stage is unchanged after all the attempts');

select * from finish();
rollback;
