-- Merge 'blog' into 'article': the app treats them as one type.
-- Postgres can't remove enum labels in place, so swap in a rebuilt type.

alter table content_items alter column type drop default;

update content_items set type = 'article' where type = 'blog';

alter type content_type rename to content_type_old;

create type content_type as enum (
  'article', 'podcast', 'video', 'tweet',
  'book', 'paper', 'other'
);

alter table content_items
  alter column type type content_type using type::text::content_type;

drop type content_type_old;

alter table content_items alter column type set default 'other';
