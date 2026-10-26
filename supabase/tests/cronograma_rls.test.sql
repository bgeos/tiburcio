-- P3-12 · Tasks, subproject materials, dependencies, locked plan and history:
-- organization isolation, role limits and integrity rules (D-025).
-- One rolled-back transaction; fictional people only.
--
-- Cast: org A = Alice (admin), Carol (member), Eve (external); org B = Bob (admin)

begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

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
-- Lookups by name are scoped to the test organizations: the local database may also
-- hold real projects and browser-test data with the same names.
insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p || '@example.test'
from unnest(array['alice', 'bob', 'carol', 'eve']) as p;

create temp table ids (
  alice uuid, bob uuid, org_a uuid, org_b uuid,
  main_stage uuid, other_project uuid, project_b uuid,
  structure uuid, shade uuid, dj uuid, elsewhere uuid, sub_b uuid
);
grant select on ids to authenticated;
insert into ids (alice, bob) values (
  (select id from auth.users where email = 'alice@example.test'),
  (select id from auth.users where email = 'bob@example.test')
);
update ids set org_a = public.create_organization('Org A', 'org-a', alice),
               org_b = public.create_organization('Org B', 'org-b', bob);
insert into public.organization_members (organization_id, user_id, role)
select org_a, (select id from auth.users where email = p || '@example.test'), r
from ids, (values ('carol', 'member'), ('eve', 'external')) as v(p, r);

insert into public.projects (organization_id, name) select org_a, 'Main Stage' from ids;
insert into public.projects (organization_id, name) select org_a, 'Chill-out Garden' from ids;
insert into public.projects (organization_id, name) select org_b, 'B Stage' from ids;
update ids set main_stage = (select id from public.projects where name = 'Main Stage' and organization_id = (select org_a from ids)),
               other_project = (select id from public.projects where name = 'Chill-out Garden' and organization_id = (select org_a from ids)),
               project_b = (select id from public.projects where name = 'B Stage' and organization_id = (select org_b from ids));
insert into public.subprojects (organization_id, project_id, name, start_date)
select org_a, main_stage, n, date '2027-01-04' from ids, unnest(array['Structure', 'Shade Sail', 'DJ Booth']) n
union all select org_a, other_project, 'Bamboo Dome', '2027-01-08' from ids
union all select org_b, project_b, 'B Area', '2027-01-04' from ids;
update ids set structure = (select id from public.subprojects where name = 'Structure' and organization_id = (select org_a from ids)),
               shade = (select id from public.subprojects where name = 'Shade Sail' and organization_id = (select org_a from ids)),
               dj = (select id from public.subprojects where name = 'DJ Booth' and organization_id = (select org_a from ids)),
               elsewhere = (select id from public.subprojects where name = 'Bamboo Dome' and organization_id = (select org_a from ids)),
               sub_b = (select id from public.subprojects where name = 'B Area' and organization_id = (select org_b from ids));
insert into public.tasks (organization_id, subproject_id, name, duration_days) select org_b, sub_b, 'B task', 2 from ids;

-- Tasks -------------------------------------------------------------------------------
select pg_temp.sign_in('alice');
select lives_ok($$ insert into public.tasks (organization_id, subproject_id, name, duration_days, sort_order)
  values ((select org_a from ids), (select structure from ids), 'Prepare bamboo', 3, 1),
         ((select org_a from ids), (select structure from ids), 'Assemble poles', 4, 2) $$,
  'admin can add tasks');
select throws_ok($$ insert into public.tasks (organization_id, subproject_id, name, duration_days)
  values ((select org_a from ids), (select structure from ids), 'Zero', 0) $$, '23514', null, 'a task lasts at least one day');
select throws_ok($$ insert into public.tasks (organization_id, subproject_id, name, duration_days, delay_days)
  values ((select org_a from ids), (select structure from ids), 'Negative wait', 2, -1) $$, '23514', null, 'waiting days cannot be negative');
select throws_ok($$ update public.tasks set progress = 101 where name = 'Prepare bamboo' $$, '23514', null, 'progress is 0–100');
select throws_ok($$ update public.tasks set actual_start = '2027-01-05', actual_end = '2027-01-04' where name = 'Prepare bamboo' $$,
  '23514', null, 'a task cannot end before it starts');
select lives_ok($$ update public.tasks set status = 'in_progress', progress = 60, actual_start = '2027-01-04' where name = 'Prepare bamboo' $$,
  'admin can record progress and actual dates');
select throws_ok($$ insert into public.tasks (organization_id, subproject_id, name, duration_days)
  values ((select org_a from ids), (select sub_b from ids), 'Sneaky', 1) $$, '23503', null, 'tasks cannot be added to another organization''s subproject');
select throws_ok($$ update public.tasks set subproject_id = (select shade from ids) where name = 'Prepare bamboo' $$,
  '42501', null, 'a task cannot be moved to another subproject');
select throws_ok($$ delete from public.tasks where name = 'Assemble poles' $$, '42501', null, 'tasks are archived, never deleted');
select is_empty($$ select 1 from public.tasks where name = 'B task' $$, 'admin cannot see another organization''s tasks');

-- Materials ----------------------------------------------------------------------------
select lives_ok($$ insert into public.subproject_materials (organization_id, subproject_id, description)
  values ((select org_a from ids), (select structure from ids), 'Steel cable, 8 mm') $$, 'admin can add materials');
select throws_ok($$ update public.subproject_materials set status = 'lost' where description = 'Steel cable, 8 mm' $$,
  '23514', null, 'material status is one of the four steps');
select lives_ok($$ update public.subproject_materials set status = 'on_site' where description = 'Steel cable, 8 mm' $$,
  'admin can update a material''s status');

-- Dependencies ---------------------------------------------------------------------------
select lives_ok($$ insert into public.subproject_dependencies (organization_id, project_id, predecessor_id, successor_id)
  values ((select org_a from ids), (select main_stage from ids), (select structure from ids), (select shade from ids)),
         ((select org_a from ids), (select main_stage from ids), (select shade from ids), (select dj from ids)) $$,
  'admin can link subprojects: Shade Sail after Structure, DJ Booth after Shade Sail');
select throws_ok($$ insert into public.subproject_dependencies (organization_id, project_id, predecessor_id, successor_id)
  values ((select org_a from ids), (select main_stage from ids), (select dj from ids), (select structure from ids)) $$,
  '23514', 'dependency_cycle', 'a link that would make a circle is refused');
select throws_ok($$ insert into public.subproject_dependencies (organization_id, project_id, predecessor_id, successor_id)
  values ((select org_a from ids), (select main_stage from ids), (select dj from ids), (select dj from ids)) $$,
  '23514', null, 'a subproject cannot depend on itself');
select throws_ok($$ insert into public.subproject_dependencies (organization_id, project_id, predecessor_id, successor_id)
  values ((select org_a from ids), (select main_stage from ids), (select structure from ids), (select shade from ids)) $$,
  '23505', null, 'the same link cannot be added twice');
select throws_ok($$ insert into public.subproject_dependencies (organization_id, project_id, predecessor_id, successor_id)
  values ((select org_a from ids), (select main_stage from ids), (select structure from ids), (select elsewhere from ids)) $$,
  '23503', null, 'links stay inside one project');
select lives_ok($$ delete from public.subproject_dependencies where successor_id = (select dj from ids) $$,
  'admin can remove a link');

-- Locked plan -----------------------------------------------------------------------------
select lives_ok($$ insert into public.plan_baselines (organization_id, project_id, snapshot)
  values ((select org_a from ids), (select main_stage from ids), '{"x": {"start": "2027-01-04", "end": "2027-01-06"}}') $$,
  'admin can lock the plan');
select is((select locked_by from public.plan_baselines), (select alice from ids), 'the database records who locked the plan');
select throws_ok($$ insert into public.plan_baselines (organization_id, project_id, snapshot)
  values ((select org_a from ids), (select main_stage from ids), '{}') $$, '23505', null, 'one locked plan per project');
select throws_ok($$ update public.plan_baselines set locked_by = (select bob from ids) $$,
  '42501', null, 'who locked the plan cannot be changed by hand');

-- History ---------------------------------------------------------------------------------
select lives_ok($$ insert into public.activity_log (organization_id, project_id, subproject_id, summary, details, reason)
  values ((select org_a from ids), (select main_stage from ids), (select structure from ids),
          'Prepare bamboo: duration 3 → 4 days', '["Structure: 4 Jan – 13 Jan → 4 Jan – 14 Jan"]', 'Bamboo delivery came late') $$,
  'admin can write a history entry');
select is((select actor_id from public.activity_log), (select alice from ids), 'history records who made the change');
select throws_ok($$ insert into public.activity_log (organization_id, project_id, summary, actor_id)
  values ((select org_a from ids), (select main_stage from ids), 'Pretending', (select bob from ids)) $$,
  '42501', null, 'nobody can write history in someone else''s name');
select throws_ok($$ update public.activity_log set summary = 'Rewritten' $$, '42501', null, 'history cannot be edited');
select throws_ok($$ delete from public.activity_log $$, '42501', null, 'history cannot be deleted');

-- Carol (member): read only ----------------------------------------------------------------
select pg_temp.sign_in('carol');
select is((select count(*) from public.tasks), 2::bigint, 'member sees the organization''s tasks');
select is_empty($$ update public.tasks set duration_days = 10 where name = 'Prepare bamboo' returning 1 $$,
  'member cannot change the cronograma');
select throws_ok($$ insert into public.activity_log (organization_id, project_id, summary)
  values ((select org_a from ids), (select main_stage from ids), 'Member note') $$, '42501', null, 'member cannot write history');

-- Eve (external) ------------------------------------------------------------------------------
select pg_temp.sign_in('eve');
select is_empty($$ select 1 from public.tasks union all select 1 from public.subproject_materials
                   union all select 1 from public.activity_log $$,
  'external collaborators see no tasks, materials or history yet');

select * from finish();
rollback;
