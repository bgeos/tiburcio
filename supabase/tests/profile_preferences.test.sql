-- D-027 · Appearance preferences on profiles: own row only, fixed choices.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p || '@example.test'
from unnest(array['pria', 'quinn']) as p;

create temp table ids as
select (select id from auth.users where email = 'pria@example.test') as pria,
       (select id from auth.users where email = 'quinn@example.test') as quinn;
grant select on ids to authenticated;

select is((select accent_color || '/' || theme_mode from public.profiles where id = (select pria from ids)), 'green/system',
  'new profiles start green, following the device');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select pria from ids), 'role', 'authenticated')::text, true);

select lives_ok($$ update public.profiles set accent_color = 'violet', theme_mode = 'dark' where id = (select pria from ids) $$,
  'a person changes their own colour and mode');
select throws_ok($$ update public.profiles set accent_color = 'red' where id = (select pria from ids) $$,
  '23514', null, 'red is not a theme colour (it means overlap)');
select throws_ok($$ update public.profiles set theme_mode = 'sepia' where id = (select pria from ids) $$,
  '23514', null, 'mode is light, dark or system');
select is_empty($$ update public.profiles set accent_color = 'pink' where id = (select quinn from ids) returning 1 $$,
  'nobody changes someone else''s colour');

reset role;
select is((select accent_color || '/' || theme_mode from public.profiles where id = (select pria from ids)), 'violet/dark',
  'the choice is saved');

select * from finish();
rollback;
