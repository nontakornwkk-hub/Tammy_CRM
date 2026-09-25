alter table public.news
  add column if not exists image_urls text[] not null default '{}'::text[],
  add column if not exists expires_at timestamptz;

update public.news
set image_urls = array[image_url]
where image_url is not null and image_url <> '' and cardinality(image_urls) = 0;
