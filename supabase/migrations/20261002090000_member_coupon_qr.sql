alter table public.coupons add column audience_mode text not null default 'public'
  check (audience_mode in ('public', 'targeted'));

create table public.member_coupon_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  campaign_id uuid references public.line_coupon_campaigns(id) on delete set null,
  qr_token uuid not null default gen_random_uuid() unique,
  status text not null default 'available' check (status in ('available','used')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  unique(owner_id,coupon_id,member_id)
);
create index member_coupon_claims_member_idx on public.member_coupon_claims(owner_id,member_id,status);
alter table public.member_coupon_claims enable row level security;
revoke all on public.member_coupon_claims from public, anon, authenticated;
grant select, insert, update, delete on public.member_coupon_claims to service_role;

create function public.issue_member_coupon_qr(p_owner_id uuid, p_member_id uuid, p_coupon_id uuid)
returns table(qr_token uuid) language plpgsql security definer set search_path = public as $$
declare v_coupon public.coupons%rowtype; v_claim public.member_coupon_claims%rowtype;
begin
  if not exists(select 1 from public.members where id=p_member_id and owner_id=p_owner_id and status='active') then raise exception 'MEMBER_NOT_FOUND'; end if;
  select * into v_coupon from public.coupons where id=p_coupon_id and owner_id=p_owner_id for update;
  if not found or not v_coupon.active or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
    or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) then raise exception 'ITEM_UNAVAILABLE'; end if;
  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then raise exception 'LIMIT_REACHED'; end if;
  if exists(select 1 from public.redemptions where owner_id=p_owner_id and member_id=p_member_id and coupon_id=p_coupon_id and status <> 'cancelled') then raise exception 'ALREADY_USED'; end if;
  select * into v_claim from public.member_coupon_claims where owner_id=p_owner_id and member_id=p_member_id and coupon_id=p_coupon_id for update;
  if found then
    if v_claim.status='used' then raise exception 'ALREADY_USED'; end if;
    if v_coupon.audience_mode='targeted' and (v_claim.campaign_id is null or not exists(select 1 from public.line_coupon_campaigns where id=v_claim.campaign_id and status='sent')) then raise exception 'NOT_ELIGIBLE'; end if;
    return query select v_claim.qr_token; return;
  end if;
  if v_coupon.audience_mode='targeted' then raise exception 'NOT_ELIGIBLE'; end if;
  insert into public.member_coupon_claims(owner_id,member_id,coupon_id) values(p_owner_id,p_member_id,p_coupon_id)
    returning * into v_claim;
  return query select v_claim.qr_token;
end $$;
revoke all on function public.issue_member_coupon_qr(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_member_coupon_qr(uuid,uuid,uuid) to service_role;

create function public.redeem_member_coupon_qr(p_owner_id uuid, p_token uuid)
returns table(member_id uuid,coupon_id uuid,redemption_id uuid) language plpgsql security definer set search_path = public as $$
declare v_claim public.member_coupon_claims%rowtype; v_coupon public.coupons%rowtype; v_redemption uuid;
begin
  select * into v_claim from public.member_coupon_claims where owner_id=p_owner_id and qr_token=p_token for update;
  if not found then raise exception 'QR_NOT_FOUND'; end if;
  if v_claim.status <> 'available' then raise exception 'ALREADY_USED'; end if;
  if v_claim.campaign_id is not null and not exists(select 1 from public.line_coupon_campaigns where id=v_claim.campaign_id and status='sent') then raise exception 'NOT_ELIGIBLE'; end if;
  if not exists(select 1 from public.members where id=v_claim.member_id and owner_id=p_owner_id and status='active') then raise exception 'MEMBER_NOT_FOUND'; end if;
  select * into v_coupon from public.coupons where id=v_claim.coupon_id and owner_id=p_owner_id for update;
  if not found or not v_coupon.active or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
    or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) then raise exception 'ITEM_UNAVAILABLE'; end if;
  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then raise exception 'LIMIT_REACHED'; end if;
  if exists(select 1 from public.redemptions where owner_id=p_owner_id and member_id=v_claim.member_id and coupon_id=v_claim.coupon_id and status <> 'cancelled') then raise exception 'ALREADY_USED'; end if;
  insert into public.redemptions(owner_id,member_id,coupon_id,points_spent,status,redeemed_at)
    values(p_owner_id,v_claim.member_id,v_claim.coupon_id,0,'completed',now()) returning id into v_redemption;
  update public.member_coupon_claims set status='used',used_at=now() where id=v_claim.id;
  update public.coupons set used_count=used_count+1,updated_at=now() where id=v_claim.coupon_id;
  return query select v_claim.member_id,v_claim.coupon_id,v_redemption;
end $$;
revoke all on function public.redeem_member_coupon_qr(uuid,uuid) from public,anon,authenticated;
grant execute on function public.redeem_member_coupon_qr(uuid,uuid) to service_role;
