create table public.crm_live_updates (
  owner_id uuid primary key references public.store_settings(owner_id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.crm_live_updates enable row level security;
revoke all on public.crm_live_updates from public, anon, authenticated;
grant select on public.crm_live_updates to authenticated;
create policy crm_live_updates_read on public.crm_live_updates for select to authenticated
using ((select public.crm_team_can(owner_id, 'manager')));
create function private.signal_coupon_usage_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(new.owner_id,old.owner_id) is null then return null; end if;
  insert into public.crm_live_updates(owner_id,updated_at) values(coalesce(new.owner_id,old.owner_id),clock_timestamp())
  on conflict(owner_id) do update set updated_at=excluded.updated_at;
  return null;
end $$;
revoke all on function private.signal_coupon_usage_change() from public,anon,authenticated;
create trigger coupon_usage_claim_change after insert or update or delete on public.member_coupon_claims
for each row execute function private.signal_coupon_usage_change();
create trigger coupon_usage_redemption_change after insert or update or delete on public.redemptions
for each row execute function private.signal_coupon_usage_change();
create trigger coupon_usage_coupon_change after insert or update or delete on public.coupons
for each row execute function private.signal_coupon_usage_change();
alter publication supabase_realtime add table public.crm_live_updates;
