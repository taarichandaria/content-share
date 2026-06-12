-- TEMPORARY (while scaling): treat every signed-in user as a friend of every
-- other user, so new accounts immediately see the shared feed instead of an
-- empty one.
--
-- This opens *content visibility* only. The real friendships data and the
-- friend feature (Friends page, Add-friend buttons, requests) are untouched.
--
-- To DISABLE without a deploy, flip the single switch:
--     create or replace function public.open_friend_mode()
--       returns boolean language sql stable as $$ select false $$;
-- or revert this migration to restore the original are_friends / friend_ids.

-- The switch. `stable` (not `immutable`) so flipping it is observed by new
-- statements immediately, without true being folded into cached plans.
create or replace function public.open_friend_mode()
returns boolean
language sql
stable
as $$ select true $$;

-- are_friends: short-circuit to true in open mode; otherwise the original
-- accepted-pair lookup. Keeps a <> b so are_friends(x, x) stays false.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a <> b and (
    public.open_friend_mode()
    or exists (
      select 1 from friendships
      where status = 'accepted'
        and user_a = least(a, b)
        and user_b = greatest(a, b)
    )
  );
$$;

-- friend_ids: in open mode every other profile is a friend; unioned with the
-- real accepted friendships so once the switch is off this is byte-for-byte
-- identical to the original (the first branch yields zero rows).
create or replace function public.friend_ids(u uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles
  where id <> u and public.open_friend_mode()
  union
  select case when user_a = u then user_b else user_a end
  from friendships
  where status = 'accepted' and (user_a = u or user_b = u);
$$;
