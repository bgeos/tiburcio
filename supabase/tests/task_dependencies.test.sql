-- P4-01 · Task links (D-027): across subprojects and projects of one organization, no circles,
-- no links inside a subproject, role limits. One rolled-back transaction; fictional people only.
--
-- Cast: org A = Alice (admin), Carol (member), Eve (external); org B = Bob (admin)

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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

create temp table ids (org_a uuid, org_b uuid, s1 uuid, s2 uuid, sew uuid, rig uuid, dome uuid, b1 uuid);
grant select on ids to authenticated;
insert into ids (org_a, org_b) values (
  public.create_organization('Org A', 'org-a', (select id from auth.users where email = 'alice@example.test')),
  public.create_organization('Org B', 'org-b', (select id from auth.users where email = 'bob@example.test'))
);
insert into public.organization_members (organization_id, user_id, role)
select org_a, (select id from auth.users where email = p || '@example.test'), r
from ids, (values ('carol', 'member'), ('eve', 'external')) as v(p, r);

-- Main Stage (Structure, Shade Sail) and Chill-out Garden (Dome) in org A; B Stage in org B.
create temp table subs as
with p as (
  insert into public.projects (organization_id, name)
  select org_a, 'Main Stage' from ids union all select org_a, 'Chill-out Garden' from ids union all select org_b, 'B Stage' from ids
  returning id, organization_id, name
)
select p.organization_id, p.id as project_id, s.name
from p join (values ('Main Stage', 'Structure'), ('Main Stage', 'Shade Sail'), ('Chill-out Garden', 'Dome'), ('B Stage', 'B Area')) s(project, name)
  on s.project = p.name;
insert into public.subprojects (organization_id, project_id, name, start_date)
select organization_id, project_id, name, date '2027-01-04' from subs;

insert into public.tasks (organization_id, subproject_id, name, duration_days, sort_order)
select s.organization_id, s.id, t.name, 2, t.n
from public.subprojects s
join (values ('Structure', 'Assemble poles', 0), ('Structure', 'Set up structure', 1), ('Shade Sail', 'Sew sail', 0),
             ('Shade Sail', 'Rig sail', 1), ('Dome', 'Build dome', 0), ('B Area', 'B task', 0)) t(sub, name, n)
  on t.sub = s.name
where s.organization_id in (select org_a from ids union select org_b from ids);

update ids set
  s1 = (select id from public.tasks where name = 'Assemble poles' and organization_id = (select org_a from ids)),
  s2 = (select id from public.tasks where name = 'Set up structure' and organization_id = (select org_a from ids)),
  sew = (select id from public.tasks where name = 'Sew sail' and organization_id = (select org_a from ids)),
  rig = (select id from public.tasks where name = 'Rig sail' and organization_id = (select org_a from ids)),
  dome = (select id from public.tasks where name = 'Build dome' and organization_id = (select org_a from ids)),
  b1 = (select id from public.tasks where name = 'B task' and organization_id = (select org_b from ids));

-- Alice (admin) ---------------------------------------------------------------------
select pg_temp.sign_in('alice');
select lives_ok($$ insert into public.task_dependencies (organization_id, predecessor_task_id, successor_task_id)
  select org_a, s2, rig from ids $$, 'Rig sail can wait for Set up structure (another subproject)');
select lives_ok($$ insert into public.task_dependencies (organization_id, predecessor_task_id, successor_task_id)
  select org_a, rig, dome from ids $$, 'a task can wait for a task in another project');
select throws_ok($$ insert into public.task_dependencies (organization_id, predecessor_task_id, successor_task_id)
  select org_a, dome, s2 from ids $$, '23514', null, 'a circle (Set up structure → Rig sail → Build dome → Set up structure) is refused');
select throws_ok($$ insert into public.task_dependencies (organization_id, predecessor_task_id, successor_task_id)
  select org_a, s1, s2 from ids $$, '23514', null, 'tasks of one subproject cannot be linked (they already run in order)');
select throws_ok($$ insert into public.task_dependencies (organization_id, predecessor_task_id, successor_task_id)
  select org_a, rig, rig from ids $$, '23514', null, 'a task cannot wait for itself');
select throws_ok($$ insert into public.task_dependencies (organization_id, predecessor_task_id, successor_task_id)
  select org_a, s2, rig from ids $$, '23505', null, 'the same link cannot be added twice');
select throws_ok($$ insert into public.task_dependencies (organization_id, predecessor_task_id, successor_task_id)
  select org_a, b1, sew from ids $$, '23503', null, 'a task cannot wait for another organization''s task');

-- Carol (member): reads, cannot change -------------------------------------------------
select pg_temp.sign_in('carol');
select is((select count(*) from public.task_dependencies), 2::bigint, 'a member sees the links');
select throws_ok($$ insert into public.task_dependencies (organization_id, predecessor_task_id, successor_task_id)
  select org_a, s2, sew from ids $$, '42501', null, 'a member cannot add links');
select is_empty($$ delete from public.task_dependencies returning 1 $$, 'a member cannot remove links');

-- Eve (external) and Bob (other organization) see nothing -------------------------------
select pg_temp.sign_in('eve');
select is_empty($$ select 1 from public.task_dependencies $$, 'external collaborators see no links');
select pg_temp.sign_in('bob');
select is_empty($$ select 1 from public.task_dependencies $$, 'another organization sees no links');

select pg_temp.sign_in('alice');
select lives_ok($$ delete from public.task_dependencies where successor_task_id = (select dome from ids) $$, 'an admin removes a link');

-- P4-08: the remaining edge cases. Set up structure → Rig sail is still linked.
select throws_ok($$ insert into public.task_dependencies (organization_id, predecessor_task_id, successor_task_id)
  select org_a, rig, s2 from ids $$, '23514', null, 'two tasks cannot wait for each other');
select lives_ok($$ update public.tasks set archived_at = now() where id = (select s2 from ids) $$, 'archiving a linked task is allowed');
reset role;
-- The link stays (the history needs it; the app ignores links to archived tasks).
-- Deleting a task for good (not possible in the app) takes its links with it.
delete from public.tasks where id = (select rig from ids);
select is((select count(*) from public.task_dependencies where organization_id = (select org_a from ids)), 0::bigint,
  'links go with a deleted task');

select * from finish();
rollback;
