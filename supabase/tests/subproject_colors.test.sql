-- D-027 · Subproject colours: editors choose from the palette, never red; members can't change them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p || '@example.test'
from unnest(array['ruth', 'sam']) as p;

create temp table ids (org uuid, project uuid, sub uuid, ruth uuid, sam uuid);
grant select on ids to authenticated;
insert into ids (org) values (public.create_organization('Colour Org', 'colour-org', (select id from auth.users where email = 'ruth@example.test')));
insert into public.organization_members (organization_id, user_id, role)
select org, (select id from auth.users where email = 'sam@example.test'), 'member' from ids;
insert into public.projects (organization_id, name) select org, 'Colour Stage' from ids;
update ids set project = (select id from public.projects where organization_id = (select org from ids));
insert into public.subprojects (organization_id, project_id, name, start_date) select org, project, 'Structure', '2027-01-04' from ids;
update ids set sub = (select id from public.subprojects where organization_id = (select org from ids)),
  ruth = (select id from auth.users where email = 'ruth@example.test'), sam = (select id from auth.users where email = 'sam@example.test');

select is((select color from public.subprojects where id = (select sub from ids)), 'blue', 'a new subproject defaults to blue');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select ruth from ids), 'role', 'authenticated')::text, true);
select lives_ok($$ update public.subprojects set color = 'violet' where id = (select sub from ids) $$, 'an admin changes the colour');
select throws_ok($$ update public.subprojects set color = 'red' where id = (select sub from ids) $$,
  '23514', null, 'red is not a subproject colour (it means overlap)');

select set_config('request.jwt.claims', json_build_object('sub', (select sam from ids), 'role', 'authenticated')::text, true);
select is_empty($$ update public.subprojects set color = 'green' where id = (select sub from ids) returning 1 $$,
  'a member cannot change colours');

reset role;
select is((select color from public.subprojects where id = (select sub from ids)), 'violet', 'the admin''s choice is kept');

select * from finish();
rollback;
