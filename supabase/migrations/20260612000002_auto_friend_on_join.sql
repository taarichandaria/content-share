-- TEMPORARY (while scaling): materialize a complete friendship graph so the
-- Friends page, the feed, and content visibility all show everyone as friends.
-- Each new account is auto-friended (request sent + accepted) with every other
-- account on join.
--
-- This SUPERSEDES the visibility short-circuit added in 20260612000001:
-- are_friends / friend_ids are restored to read the (now fully-populated)
-- friendships table, making that table the single source of truth — so the
-- Friends page, profile buttons, feed, and RLS all agree, and unfriending
-- behaves normally. The open_friend_mode() switch is retained to gate the
-- auto-friend trigger (and to disable it in the friend-gating pgTAP suites).
--
-- To DISABLE: flip open_friend_mode() to `select false` (new joiners stop being
-- auto-friended; everything else reverts to normal friend mechanics):
--     create or replace function public.open_friend_mode()
--       returns boolean language sql stable as $$ select false $$;
-- Existing auto-friendships persist; to fully reset, delete the friendship rows
-- created at/after this migration.

-- ---------------------------------------------------------------------------
-- 1. Restore are_friends / friend_ids to their original table-only definitions
--    (undo the 20260612000001 short-circuit).
-- ---------------------------------------------------------------------------

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and user_a = least(a, b)
      and user_b = greatest(a, b)
  );
$$;

create or replace function public.friend_ids(u uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when user_a = u then user_b else user_a end
  from friendships
  where status = 'accepted' and (user_a = u or user_b = u);
$$;

-- ---------------------------------------------------------------------------
-- 2. Auto-friend each new profile with every existing profile (accepted),
--    gated on open_friend_mode(). Security definer so it bypasses RLS like the
--    signup trigger it fires alongside.
-- ---------------------------------------------------------------------------

create or replace function public.auto_friend_on_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.open_friend_mode() then
    return new;
  end if;
  insert into friendships (user_a, user_b, requester_id, status, responded_at)
  select least(new.id, p.id), greatest(new.id, p.id), new.id, 'accepted', now()
  from profiles p
  where p.id <> new.id
  on conflict (user_a, user_b) do nothing;
  return new;
end;
$$;

create trigger profiles_auto_friend
  after insert on profiles
  for each row execute function public.auto_friend_on_join();

-- ---------------------------------------------------------------------------
-- 3. Backfill existing accounts into a complete accepted graph: promote any
--    pending requests, then fill in every still-missing pair.
-- ---------------------------------------------------------------------------

update friendships set status = 'accepted' where status <> 'accepted';

insert into friendships (user_a, user_b, requester_id, status, responded_at)
select p1.id, p2.id, p1.id, 'accepted', now()
from profiles p1
join profiles p2 on p1.id < p2.id
on conflict (user_a, user_b) do nothing;
