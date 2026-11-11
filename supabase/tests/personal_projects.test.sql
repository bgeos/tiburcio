-- Plan § 5 · Personal projects: only their owner sees or changes them.
-- One rolled-back transaction; fictional people only.

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
from unnest(array['alice', 'bob']) as p;

select pg_temp.sign_in('alice');
select lives_ok($$ insert into public.personal_projects (name, slug, category) values ('Mota', 'mota', 'garage') $$,
  'the owner creates a project');
select is((select user_id from public.personal_projects where slug = 'mota'),
  (select id from auth.users where email = 'alice@example.test'), 'and owns it');
select throws_ok($$ insert into public.personal_projects (name, slug) values ('Copy', 'mota') $$,
  '23505', null, 'a slug is used once per owner');
select throws_ok($$ insert into public.personal_projects (name, slug, category) values ('X', 'x', 'nope') $$,
  '23514', null, 'the category must be a known one');
select throws_ok(
  $$ insert into public.personal_projects (user_id, name, slug) values ((select id from auth.users where email = 'bob@example.test'), 'Gift', 'gift') $$,
  '42501', null, 'nobody can create a project for someone else');

select pg_temp.sign_in('bob');
select is_empty($$ select 1 from public.personal_projects $$, 'another person sees none of them');
select is_empty($$ update public.personal_projects set name = 'Mine now' returning 1 $$, 'nor changes them');
select is_empty($$ delete from public.personal_projects returning 1 $$, 'nor deletes them');

select pg_temp.sign_in('alice');
select is((select name from public.personal_projects where slug = 'mota'), 'Mota', 'the owner''s project is untouched');

select * from finish();
rollback;
