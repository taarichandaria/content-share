-- Content Share: core schema
-- Enums, tables, indexes, triggers, and helper functions.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type content_type as enum (
  'article', 'blog', 'podcast', 'video', 'tweet',
  'book', 'paper', 'movie', 'recipe', 'other'
);

create type friendship_status as enum ('pending', 'accepted');

create type read_status as enum ('reading', 'finished', 'abandoned');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     citext unique not null check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text not null default '',
  avatar_url   text,
  bio          text,
  created_at   timestamptz not null default now()
);

-- Auto-create a profile when an auth user is created. Username comes from
-- signup metadata, falling back to the email local-part, then a random handle.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
begin
  base := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
  base := lower(regexp_replace(base, '[^a-zA-Z0-9_]', '', 'g'));
  base := substr(base, 1, 20);
  if length(base) < 3 then
    base := 'user' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  candidate := base;
  while exists (select 1 from profiles where username = candidate) loop
    candidate := substr(base, 1, 18) || lpad(floor(random() * 10000)::int::text, 4, '0');
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      candidate
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- friendships: one canonical row per pair (user_a < user_b)
-- ---------------------------------------------------------------------------

create table friendships (
  user_a       uuid not null references profiles (id) on delete cascade,
  user_b       uuid not null references profiles (id) on delete cascade,
  requester_id uuid not null references profiles (id),
  status       friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requester_id in (user_a, user_b))
);

create index friendships_user_b on friendships (user_b) where status = 'accepted';

-- Participants and request direction are immutable; the only legal update is
-- the addressee flipping pending -> accepted (enforced together with RLS).
create or replace function public.guard_friendship_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_a <> old.user_a
     or new.user_b <> old.user_b
     or new.requester_id <> old.requester_id then
    raise exception 'friendship participants cannot be changed';
  end if;
  if old.status = 'accepted' then
    raise exception 'friendship is already accepted';
  end if;
  new.responded_at := now();
  return new;
end;
$$;

create trigger friendships_guard_update
  before update on friendships
  for each row execute function public.guard_friendship_update();

-- Security definer so RLS policies on other tables can consult friendships
-- without recursive policy evaluation.
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
-- content_items: the generalizable "thing being shared"
-- Owned per-post (not deduplicated) so each sharer controls their own metadata.
-- ---------------------------------------------------------------------------

create table content_items (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references profiles (id) on delete cascade,
  type        content_type not null default 'other',
  url         text,
  title       text not null check (char_length(title) between 1 and 500),
  description text,
  image_url   text,
  site_name   text,
  creator     text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index content_items_created_by on content_items (created_by);

-- ---------------------------------------------------------------------------
-- reads: an ongoing book (user x content_item) with lifecycle status
-- ---------------------------------------------------------------------------

create table reads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles (id) on delete cascade,
  content_item_id uuid not null references content_items (id) on delete cascade,
  status          read_status not null default 'reading',
  started_at      date not null default current_date,
  finished_at     date,
  created_at      timestamptz not null default now()
);

-- One active read per book per user; re-reads allowed once finished/abandoned.
create unique index reads_one_active on reads (user_id, content_item_id)
  where status = 'reading';
create index reads_user on reads (user_id, status);

-- ---------------------------------------------------------------------------
-- posts: unified feed items (regular shares and book-progress updates)
-- content_item_id is always set, including progress posts, so the feed is one
-- uniform query. read_id non-null marks a book-progress post.
-- ---------------------------------------------------------------------------

create table posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references profiles (id) on delete cascade,
  content_item_id uuid not null references content_items (id) on delete restrict,
  read_id         uuid references reads (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 5000),
  progress        text check (progress is null or char_length(progress) <= 100),
  created_at      timestamptz not null default now(),
  check (read_id is not null or progress is null)
);

create index posts_author_created on posts (author_id, created_at desc, id);
create index posts_read on posts (read_id) where read_id is not null;

-- Progress posts must point at the author's own read, and the denormalized
-- content_item_id must match the read's.
create or replace function public.guard_post_read_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r reads%rowtype;
begin
  if new.read_id is not null then
    select * into r from reads where id = new.read_id;
    if not found then
      raise exception 'read % does not exist', new.read_id;
    end if;
    if r.user_id <> new.author_id then
      raise exception 'read does not belong to the post author';
    end if;
    if r.content_item_id <> new.content_item_id then
      raise exception 'post content_item_id must match the read''s content item';
    end if;
  end if;
  return new;
end;
$$;

create trigger posts_guard_read_consistency
  before insert or update on posts
  for each row execute function public.guard_post_read_consistency();

-- ---------------------------------------------------------------------------
-- comments: flat, ordered by created_at
-- ---------------------------------------------------------------------------

create table comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts (id) on delete cascade,
  author_id  uuid not null references profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index comments_post on comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------------

create table likes (
  post_id    uuid not null references posts (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index likes_user on likes (user_id);
