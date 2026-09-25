-- Only fields intended for the customer-facing shop page are publicly readable.
create table public.public_shop_profiles (
  slug text primary key check (slug = 'tammy'),
  owner_id uuid not null unique references public.store_settings(owner_id) on delete cascade,
  customer_url text not null default '',
  shop_name text not null default 'แทมมี่อาหารสัตว์',
  shop_name_en text not null default 'Tammy Pet Shop',
  description text not null default '',
  welcome_message text not null default '',
  logo_url text,
  contacts jsonb not null default '[]'::jsonb check (jsonb_typeof(contacts) = 'array'),
  store_hours_enabled boolean not null default true,
  weekly_hours jsonb not null default '[]'::jsonb check (jsonb_typeof(weekly_hours) = 'array'),
  temporary_closure jsonb not null default '{}'::jsonb check (jsonb_typeof(temporary_closure) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.public_shop_profiles enable row level security;
revoke all on public.public_shop_profiles from anon, authenticated;
grant select on public.public_shop_profiles to anon, authenticated;
grant insert, update on public.public_shop_profiles to authenticated;

create policy "shop_profile_read" on public.public_shop_profiles
for select to anon, authenticated using (true);
create policy "shop_profile_insert_owner" on public.public_shop_profiles
for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "shop_profile_update_owner" on public.public_shop_profiles
for update to authenticated using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

insert into public.public_shop_profiles
  (slug, owner_id, shop_name, shop_name_en, description, welcome_message, logo_url)
select 'tammy', owner_id, shop_name, shop_name_en, description, welcome_message, logo_url
from public.store_settings
order by updated_at desc
limit 1
on conflict (slug) do nothing;
