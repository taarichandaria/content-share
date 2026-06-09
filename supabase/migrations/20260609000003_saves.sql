-- saves: private bookmarks of posts ("save what a friend shared")
-- A save references the post, not the content item, so the saved page can
-- always show what the recommender said about it.

create table saves (
  post_id    uuid not null references posts (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index saves_user on saves (user_id, created_at desc);

alter table saves enable row level security;

-- Unlike comments/likes, saves are private: only the saver ever sees their
-- rows (the post author cannot see who saved). Inserting still piggybacks on
-- posts visibility via an invoker-rights EXISTS, so you can only save posts
-- you can see. Rows survive unfriending, but the post behind them becomes
-- invisible — the query layer inner-joins posts so such saves drop out.

create policy saves_select on saves
  for select to authenticated
  using (user_id = auth.uid());

create policy saves_insert on saves
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from posts p where p.id = post_id)
  );

create policy saves_delete on saves
  for delete to authenticated
  using (user_id = auth.uid());
