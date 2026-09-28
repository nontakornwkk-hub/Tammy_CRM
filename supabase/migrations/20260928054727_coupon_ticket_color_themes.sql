alter table public.coupons
  add column if not exists theme_color text not null default 'coral'
  check (theme_color in ('coral', 'honey', 'rose'));
