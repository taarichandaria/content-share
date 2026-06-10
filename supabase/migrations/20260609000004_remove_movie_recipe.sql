-- Drop 'movie' and 'recipe' from content_type: the app no longer offers them.
-- Postgres can't remove enum labels in place, so swap in a rebuilt type.

alter table content_items alter column type drop default;

update content_items set type = 'other' where type in ('movie', 'recipe');

alter type content_type rename to content_type_old;

create type content_type as enum (
  'article', 'blog', 'podcast', 'video', 'tweet',
  'book', 'paper', 'other'
);

alter table content_items
  alter column type type content_type using type::text::content_type;

drop type content_type_old;

alter table content_items alter column type set default 'other';
