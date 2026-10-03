alter table public.coupons drop constraint if exists coupons_theme_color_check;
alter table public.coupons add constraint coupons_theme_color_check check (theme_color in ('coral','honey','rose','mint','lavender'));
