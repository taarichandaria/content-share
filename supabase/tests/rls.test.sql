-- RLS + friendship state machine tests. Run with `supabase test db`.
-- Each test file runs in a transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres: bypasses RLS, signup trigger still fires)
-- alice < bob < carol by uuid, so canonical pairs are written in that order.
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.local', '{"username":"alice"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.local',   '{"username":"bob"}',   '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@test.local', '{"username":"carol"}', '{}', now(), now());

select is(
  (select count(*)::int from profiles),
  3,
  'signup trigger created a profile per auth user'
);

-- alice <-> bob accepted; alice -> carol pending
insert into friendships (user_a, user_b, requester_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'accepted'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a', 'pending');

-- alice: one article post (with a comment) and one in-progress book read
insert into content_items (id, created_by, type, url, title) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'article', 'https://example.com/a', 'Alice article'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'book', null, 'Some Book');

insert into posts (id, author_id, content_item_id, body) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'Great read!');

insert into comments (post_id, author_id, body) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'adding my own note');

insert into reads (id, user_id, content_item_id) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- Structural integrity
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into friendships (user_a, user_b, requester_id)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a')$$,
  '23505', null,
  'duplicate friendship pair is rejected by the primary key'
);

select throws_ok(
  $$insert into friendships (user_a, user_b, requester_id)
    values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a')$$,
  '23514', null,
  'reversed (non-canonical) pair is rejected by the check constraint'
);

select throws_ok(
  $$insert into posts (author_id, content_item_id, read_id, body)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'mismatched item')$$,
  null, 'post content_item_id must match the read''s content item',
  'progress post must reference the read''s own content item'
);

-- ---------------------------------------------------------------------------
-- As bob (accepted friend of alice)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(
  (select count(*)::int from posts where author_id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'bob sees his friend alice''s post'
);

select is(
  (select count(*)::int from comments),
  1,
  'bob sees comments on alice''s post'
);

select is(
  (select count(*)::int from reads where user_id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'bob sees alice''s in-progress read'
);

select ok(
  are_friends('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'),
  'are_friends() is true for an accepted pair'
);

select throws_ok(
  $$insert into posts (author_id, content_item_id, body)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'forged as alice')$$,
  '42501', null,
  'bob cannot insert a post authored as alice'
);

insert into content_items (id, created_by, type, title)
values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 'book', 'Bob''s copy');

select throws_ok(
  $$insert into posts (author_id, content_item_id, read_id, body)
    values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'progress on someone else''s read')$$,
  null, 'read does not belong to the post author',
  'bob cannot attach a progress post to alice''s read'
);

-- ---------------------------------------------------------------------------
-- As carol (only a PENDING request from alice — no visibility yet)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select is(
  (select count(*)::int from posts),
  0,
  'carol (pending, not accepted) sees no posts'
);

select is(
  (select count(*)::int from comments),
  0,
  'carol sees no comments either'
);

-- ---------------------------------------------------------------------------
-- Friendship state machine
-- ---------------------------------------------------------------------------

-- alice (the requester) tries to accept her own request: RLS filters the row,
-- so the update silently affects nothing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
update friendships set status = 'accepted'
  where user_b = '00000000-0000-0000-0000-00000000000c';

select is(
  (select status::text from friendships where user_b = '00000000-0000-0000-0000-00000000000c'),
  'pending',
  'the requester cannot accept their own request'
);

-- carol (the addressee) accepts for real.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
update friendships set status = 'accepted'
  where user_b = '00000000-0000-0000-0000-00000000000c';

select is(
  (select status::text from friendships where user_b = '00000000-0000-0000-0000-00000000000c'),
  'accepted',
  'the addressee can accept the request'
);

select ok(
  (select responded_at is not null from friendships where user_b = '00000000-0000-0000-0000-00000000000c'),
  'accepting stamps responded_at via the guard trigger'
);

select is(
  (select count(*)::int from posts where author_id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'after accepting, carol can see alice''s post'
);

-- carol requests bob; bob tries to accept while tampering with requester_id.
insert into friendships (user_a, user_b, requester_id)
values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok(
  $$update friendships
      set status = 'accepted', requester_id = '00000000-0000-0000-0000-00000000000b'
    where user_a = '00000000-0000-0000-0000-00000000000b' and user_b = '00000000-0000-0000-0000-00000000000c'$$,
  null, 'friendship participants cannot be changed',
  'accepting cannot tamper with friendship participants'
);

-- bob unfriends alice; visibility is revoked immediately.
delete from friendships
  where user_a = '00000000-0000-0000-0000-00000000000a'
    and user_b = '00000000-0000-0000-0000-00000000000b';

select is(
  (select count(*)::int from posts where author_id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'after unfriending, bob no longer sees alice''s posts'
);

select * from finish();
rollback;
