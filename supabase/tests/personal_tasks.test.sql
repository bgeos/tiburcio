-- D-028 · My tasks: each person sees and changes only their own, only in their organizations.
-- One rolled-back transaction; fictional people only.
--
-- Cast: org A = Alice (admin), Carol (member), Eve (external); org B = Bob (admin)

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

insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p || '@example.test'
from unnest(array['alice', 'bob', 'carol', 'eve']) as p;

create temp table ids (org_a uuid, org_b uuid);
grant select on ids to authenticated;
insert into ids values (
  public.create_organization('Org A', 'org-a', (select id from auth.users where email = 'alice@example.test')),
  public.create_organization('Org B', 'org-b', (select id from auth.users where email = 'bob@example.test'))
);
insert into public.organization_members (organization_id, user_id, role)
select org_a, (select id from auth.users where email = p || '@example.test'), r
from ids, (values ('carol', 'member'), ('eve', 'external')) as v(p, r);

select pg_temp.sign_in('carol');
select lives_ok($$ insert into public.personal_tasks (organization_id, name, tag) select org_a, 'Call the bamboo supplier', 'reminder' from ids $$,
  'a member writes a reminder for themself');
select is((select status || '/' || tag from public.personal_tasks), 'todo/reminder', 'it starts as to do');
select throws_ok($$ insert into public.personal_tasks (organization_id, name) select org_b, 'Sneak in' from ids $$,
  '42501', null, 'nobody writes tasks in an organization they are not in');
select throws_ok($$ insert into public.personal_tasks (organization_id, name, tag) select org_a, 'Odd', 'urgent' from ids $$,
  '23514', null, 'the tag is to do or reminder');
select throws_ok($$ insert into public.personal_tasks (organization_id, name) select org_a, '   ' from ids $$,
  '23514', null, 'a task needs a name');
select lives_ok($$ update public.personal_tasks set status = 'done', description = 'Asked for 40 poles' $$,
  'the owner updates it');
select lives_ok($$ update public.personal_tasks set due_date = '2027-03-05' $$, 'and gives it a due date');

select pg_temp.sign_in('eve');
select lives_ok($$ insert into public.personal_tasks (organization_id, name) select org_a, 'Bring the drill' from ids $$,
  'external collaborators have their own tasks too');
select is((select count(*)::int from public.personal_tasks), 1, 'and see only theirs');

select pg_temp.sign_in('alice');
select is_empty($$ select 1 from public.personal_tasks $$, 'not even an admin sees other people''s tasks');
select is_empty($$ update public.personal_tasks set name = 'Hijacked' returning 1 $$, 'or changes them');
select is_empty($$ delete from public.personal_tasks returning 1 $$, 'or deletes them');

select pg_temp.sign_in('carol');
select is((select name || ': ' || status || ' ' || due_date from public.personal_tasks), 'Call the bamboo supplier: done 2027-03-05', 'Carol''s task is untouched');
select is_empty($$ select 1 from public.personal_tasks where due_date is null $$, 'Carol''s only task has its date');

select * from finish();
rollback;
