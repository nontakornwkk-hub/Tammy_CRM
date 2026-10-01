create or replace function public.redeem_member_coupon_qr(p_owner_id uuid, p_token uuid)
returns table(member_id uuid,coupon_id uuid,redemption_id uuid) language plpgsql security definer set search_path = public as $$
declare v_claim public.member_coupon_claims%rowtype; v_coupon public.coupons%rowtype; v_redemption uuid;
begin
  select * into v_claim from public.member_coupon_claims c where c.owner_id=p_owner_id and c.qr_token=p_token for update;
  if not found then raise exception 'QR_NOT_FOUND'; end if;
  if v_claim.status <> 'available' then raise exception 'ALREADY_USED'; end if;
  if v_claim.campaign_id is not null and not exists(select 1 from public.line_coupon_campaigns lc where lc.id=v_claim.campaign_id and lc.status='sent') then raise exception 'NOT_ELIGIBLE'; end if;
  if not exists(select 1 from public.members m where m.id=v_claim.member_id and m.owner_id=p_owner_id and m.status='active') then raise exception 'MEMBER_NOT_FOUND'; end if;
  select * into v_coupon from public.coupons c where c.id=v_claim.coupon_id and c.owner_id=p_owner_id for update;
  if not found or not v_coupon.active or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
    or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) then raise exception 'ITEM_UNAVAILABLE'; end if;
  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then raise exception 'LIMIT_REACHED'; end if;
  if exists(select 1 from public.redemptions r where r.owner_id=p_owner_id and r.member_id=v_claim.member_id and r.coupon_id=v_claim.coupon_id and r.status <> 'cancelled') then raise exception 'ALREADY_USED'; end if;
  insert into public.redemptions(owner_id,member_id,coupon_id,points_spent,status,redeemed_at)
    values(p_owner_id,v_claim.member_id,v_claim.coupon_id,0,'completed',now()) returning id into v_redemption;
  update public.member_coupon_claims c set status='used',used_at=now() where c.id=v_claim.id;
  update public.coupons c set used_count=used_count+1,updated_at=now() where c.id=v_claim.coupon_id;
  return query select v_claim.member_id,v_claim.coupon_id,v_redemption;
end $$;
revoke all on function public.redeem_member_coupon_qr(uuid,uuid) from public,anon,authenticated;
grant execute on function public.redeem_member_coupon_qr(uuid,uuid) to service_role;
