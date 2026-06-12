-- Auto-friend-on-join: while open_friend_mode() is true, each new profile is
-- auto-friended (accepted) with every existing profile; when it's false, new
-- profiles get no auto-friendships. Each test file runs in a transaction and
-- is rolled back. Self-contained: does not depend on seed data.

begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- ---------------------------------------------------------------------------
-- Open mode ON (the default): joining auto-friends with everyone
-- ---------------------------------------------------------------------------

select ok(open_friend_mode(), 'open_friend_mode() is enabled by default');

-- dave joins, then erin joins; erin should be auto-friended with dave.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave@test.local', '{"username":"daveauto"}', '{}', now(), now());
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'erin@test.local', '{"username":"erinauto"}', '{}', now(), now());

select is(
  (select status::text from friendships
     where user_a = '00000000-0000-0000-0000-00000000000d'
       and user_b = '00000000-0000-0000-0000-00000000000e'),
  'accepted',
  'joining auto-creates an accepted friendship between dave and erin'
);

select ok(
  are_friends('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000e'),
  'are_friends() is true for the auto-friended pair'
);

-- dave shares a post; erin (auto-friend) can see it under RLS.
insert into content_items (id, created_by, type, url, title) values
  ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000d', 'article', 'https://example.com/d', 'Dave article');
insert into posts (id, author_id, content_item_id, body) values
  ('20000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-0000000000d1', 'Dave shares');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);

select is(
  (select count(*)::int from posts where author_id = '00000000-0000-0000-0000-00000000000d'),
  1,
  'erin sees dave''s post via the auto-friendship'
);

-- ---------------------------------------------------------------------------
-- Open mode OFF: joining does NOT auto-friend
-- ---------------------------------------------------------------------------

reset role;
create or replace function public.open_friend_mode()
  returns boolean language sql stable as $$ select false $$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gina@test.local', '{"username":"ginaauto"}', '{}', now(), now());

select is(
  (select count(*)::int from friendships
     where user_a = '00000000-0000-0000-0000-00000000000f'
        or user_b = '00000000-0000-0000-0000-00000000000f'),
  0,
  'with open mode off, a new joiner gets no auto-friendships'
);

select ok(
  not are_friends('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000d'),
  'gina is not auto-friended with dave when open mode is off'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);

select is(
  (select count(*)::int from posts where author_id = '00000000-0000-0000-0000-00000000000d'),
  0,
  'gina sees no posts (not auto-friended)'
);

select * from finish();
rollback;
