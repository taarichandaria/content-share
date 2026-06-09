-- RLS tests for saves (private bookmarks). Run with `supabase test db`.
-- Each test file runs in a transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres: bypasses RLS, signup trigger still fires)
-- alice < bob < carol by uuid. alice <-> bob accepted; alice -> carol pending.
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.local', '{"username":"alice"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.local',   '{"username":"bob"}',   '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@test.local', '{"username":"carol"}', '{}', now(), now());

insert into friendships (user_a, user_b, requester_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'accepted'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a', 'pending');

insert into content_items (id, created_by, type, url, title) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'article', 'https://example.com/a', 'Alice article');

insert into posts (id, author_id, content_item_id, body) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'Great read!');

-- ---------------------------------------------------------------------------
-- As bob (accepted friend of alice): can save her post, privately
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

insert into saves (post_id, user_id) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');

select is(
  (select count(*)::int from saves),
  1,
  'bob can save a visible friend''s post and read it back'
);

select throws_ok(
  $$insert into saves (post_id, user_id)
    values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b')$$,
  '23505', null,
  'saving the same post twice is rejected by the primary key'
);

select throws_ok(
  $$insert into saves (post_id, user_id)
    values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null,
  'bob cannot create a save on another user''s behalf'
);

-- ---------------------------------------------------------------------------
-- As carol (only a PENDING request from alice): the post is invisible
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select throws_ok(
  $$insert into saves (post_id, user_id)
    values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c')$$,
  '42501', null,
  'carol cannot save a post she cannot see'
);

-- ---------------------------------------------------------------------------
-- As alice (the post author): saves are private to the saver
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is(
  (select count(*)::int from saves),
  0,
  'the post author cannot see who saved their post'
);

-- ---------------------------------------------------------------------------
-- As bob: unsave, then re-save (setup for the cascade tests below)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

delete from saves where post_id = '20000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from saves),
  0,
  'the saver can remove their own save'
);

insert into saves (post_id, user_id) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');

-- ---------------------------------------------------------------------------
-- Unfriending hides the post but keeps the save row
-- ---------------------------------------------------------------------------

reset role;
delete from friendships
  where user_a = '00000000-0000-0000-0000-00000000000a'
    and user_b = '00000000-0000-0000-0000-00000000000b';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(
  (select count(*)::int from saves) - (select count(*)::int from posts),
  1,
  'after unfriending, bob''s save row remains but the post is hidden'
);

-- ---------------------------------------------------------------------------
-- Deleting the post cascades away its saves
-- ---------------------------------------------------------------------------

reset role;
delete from posts where id = '20000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from saves),
  0,
  'deleting a post cascades to its saves'
);

select * from finish();
rollback;
