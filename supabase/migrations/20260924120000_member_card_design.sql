-- Public design choices only; member details remain in protected members table.
alter table public.public_shop_profiles
  add column if not exists card_design jsonb not null default '{}'::jsonb
  check (jsonb_typeof(card_design) = 'object');
