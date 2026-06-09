-- Content Share: row level security
-- Visibility model: a user sees their own rows and their accepted friends'
-- rows. Comments and likes piggyback on posts visibility via invoker-rights
-- EXISTS subqueries, so posts RLS applies transitively.

alter table profiles      enable row level security;
alter table friendships   enable row level security;
alter table content_items enable row level security;
alter table reads         enable row level security;
alter table posts         enable row level security;
alter table comments      enable row level security;
alter table likes         enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: readable by any signed-in user (needed for people search);
-- writable only by the owner. Inserts happen via the signup trigger.
-- ---------------------------------------------------------------------------

create policy profiles_select on profiles
  for select to authenticated
  using (true);

create policy profiles_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------

create policy friendships_select on friendships
  for select to authenticated
  using (auth.uid() in (user_a, user_b));

-- Only the requester may create the request, and only as pending.
create policy friendships_insert on friendships
  for insert to authenticated
  with check (
    auth.uid() = requester_id
    and auth.uid() in (user_a, user_b)
    and status = 'pending'
  );

-- Only the addressee may accept; the guard trigger pins all other columns.
create policy friendships_update on friendships
  for update to authenticated
  using (
    status = 'pending'
    and auth.uid() in (user_a, user_b)
    and auth.uid() <> requester_id
  )
  with check (status = 'accepted');

-- Either side may cancel / decline / unfriend.
create policy friendships_delete on friendships
  for delete to authenticated
  using (auth.uid() in (user_a, user_b));

-- ---------------------------------------------------------------------------
-- content_items: owner + friends read; owner writes
-- ---------------------------------------------------------------------------

create policy content_items_select on content_items
  for select to authenticated
  using (created_by = auth.uid() or are_friends(auth.uid(), created_by));

create policy content_items_insert on content_items
  for insert to authenticated
  with check (created_by = auth.uid());

create policy content_items_update on content_items
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy content_items_delete on content_items
  for delete to authenticated
  using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- reads: owner + friends read; owner writes
-- ---------------------------------------------------------------------------

create policy reads_select on reads
  for select to authenticated
  using (user_id = auth.uid() or are_friends(auth.uid(), user_id));

create policy reads_insert on reads
  for insert to authenticated
  with check (user_id = auth.uid());

create policy reads_update on reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy reads_delete on reads
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- posts: author + friends read; author writes
-- ---------------------------------------------------------------------------

create policy posts_select on posts
  for select to authenticated
  using (author_id = auth.uid() or are_friends(auth.uid(), author_id));

-- Posts may only reference the author's own content_items copy; otherwise a
-- post could pin someone else's row against its on-delete-restrict FK.
create policy posts_insert on posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from content_items ci
      where ci.id = content_item_id and ci.created_by = auth.uid()
    )
  );

create policy posts_update on posts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy posts_delete on posts
  for delete to authenticated
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- comments: visible wherever the post is visible (invoker-rights subquery)
-- ---------------------------------------------------------------------------

create policy comments_select on comments
  for select to authenticated
  using (exists (select 1 from posts p where p.id = post_id));

create policy comments_insert on comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from posts p where p.id = post_id)
  );

create policy comments_delete on comments
  for delete to authenticated
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- likes: same piggyback pattern as comments
-- ---------------------------------------------------------------------------

create policy likes_select on likes
  for select to authenticated
  using (exists (select 1 from posts p where p.id = post_id));

create policy likes_insert on likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from posts p where p.id = post_id)
  );

create policy likes_delete on likes
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- storage: public avatars bucket, writes scoped to the user's own folder
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_read on storage.objects
  for select to public
  using (bucket_id = 'avatars');

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
