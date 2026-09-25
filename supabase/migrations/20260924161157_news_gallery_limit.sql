alter table public.news
  add constraint news_image_urls_max_ten check (cardinality(image_urls) <= 10);
