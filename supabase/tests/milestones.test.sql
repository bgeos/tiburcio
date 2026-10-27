-- P4-05 · Milestones (D-030): organization-wide key dates, tasks linked to them, role limits.
-- One rolled-back transaction; fictional people only.
--
-- Cast: org A = Alice (admin), Carol (member), Eve (external); org B = Bob (admin)

begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
from unnest(array['alice', 'bob', 'carol', 'eve']) as p;

create temp table ids (org_a uuid, org_b uuid, task uuid, b_milestone uuid);
grant select on ids to authenticated;
insert into ids (org_a, org_b) values (
  public.create_organization('Org A', 'org-a', (select id from auth.users where email = 'alice@example.test')),
  public.create_organization('Org B', 'org-b', (select id from auth.users where email = 'bob@example.test'))
);
insert into public.organization_members (organization_id, user_id, role)
select org_a, (select id from auth.users where email = p || '@example.test'), r
from ids, (values ('carol', 'member'), ('eve', 'external')) as v(p, r);

-- Main Stage › Structure › Set up structure in org A; a milestone in org B.
with p as (insert into public.projects (organization_id, name) select org_a, 'Main Stage' from ids returning id, organization_id),
s as (insert into public.subprojects (organization_id, project_id, name, start_date) select organization_id, id, 'Structure', date '2027-01-04' from p returning id, organization_id),
t as (insert into public.tasks (organization_id, subproject_id, name, duration_days) select organization_id, id, 'Set up structure', 3 from s returning id)
update ids set task = (select id from t);
with m as (insert into public.milestones (organization_id, name, date) select org_b, 'B opens', date '2027-02-01' from ids returning id)
update ids set b_milestone = (select id from m);

select pg_temp.sign_in('alice');
select lives_ok($$ insert into public.milestones (organization_id, name, date) select org_a, 'Festival opens', date '2027-01-20' from ids $$,
  'an admin adds a milestone');
select throws_ok($$ insert into public.milestones (organization_id, name, date) select org_a, '  ', date '2027-01-20' from ids $$,
  '23514', null, 'a milestone needs a name');
select lives_ok($$ insert into public.task_milestones (organization_id, task_id, milestone_id)
  select org_a, task, (select id from public.milestones where name = 'Festival opens') from ids $$,
  'a task is linked to it');
select throws_ok($$ insert into public.task_milestones (organization_id, task_id, milestone_id)
  select org_a, task, (select id from public.milestones where name = 'Festival opens') from ids $$,
  '23505', null, 'only once');
select throws_ok($$ insert into public.task_milestones (organization_id, task_id, milestone_id) select org_a, task, b_milestone from ids $$,
  '23503', null, 'not to another organization''s milestone');
select is((select count(*)::int from public.milestones), 1, 'admins see only their organization''s milestones');

select pg_temp.sign_in('carol');
select is((select count(*)::int from public.task_milestones), 1, 'members see milestones and links');
select throws_ok($$ insert into public.milestones (organization_id, name, date) select org_a, 'Mine', date '2027-01-21' from ids $$,
  '42501', null, 'members cannot add milestones');
select is_empty($$ delete from public.task_milestones returning 1 $$, 'or remove links');

select pg_temp.sign_in('eve');
select is_empty($$ select 1 from public.milestones $$, 'external collaborators see no milestones (D-025)');

select pg_temp.sign_in('alice');
select lives_ok($$ update public.milestones set date = date '2027-01-22' where name = 'Festival opens' $$, 'an admin moves a milestone');
delete from public.milestones where name = 'Festival opens';
select is((select count(*)::int from public.task_milestones), 0, 'deleting a milestone removes its links');

select * from finish();
rollback;
