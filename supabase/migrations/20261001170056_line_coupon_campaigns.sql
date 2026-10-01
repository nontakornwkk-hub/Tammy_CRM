create table public.line_coupon_campaigns (
  id uuid primary key,
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  coupon_id uuid references public.coupons(id) on delete set null,
  coupon_title text not null,
  segment jsonb not null,
  message text not null,
  recipient_count integer not null check (recipient_count between 1 and 500),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  line_request_id text,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index line_coupon_campaigns_owner_created_idx
  on public.line_coupon_campaigns(owner_id, created_at desc);

alter table public.line_coupon_campaigns enable row level security;
revoke all on public.line_coupon_campaigns from public, anon, authenticated;
grant select, insert, update on public.line_coupon_campaigns to service_role;
