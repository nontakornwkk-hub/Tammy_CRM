alter table public.news
  add column if not exists starts_at timestamptz;
