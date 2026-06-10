-- content_type enum: movie/recipe were removed (20260609000003),
-- blog merged into article (20260610000001).
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select has_enum('public', 'content_type', 'content_type enum exists');

select enum_has_labels(
  'public',
  'content_type',
  array['article', 'podcast', 'video', 'tweet', 'book', 'paper', 'other'],
  'content_type has exactly the supported labels'
);

select * from finish();
rollback;
