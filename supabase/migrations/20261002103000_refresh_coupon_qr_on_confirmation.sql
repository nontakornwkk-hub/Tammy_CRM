create or replace function public.issue_member_coupon_qr(p_owner_id uuid, p_member_id uuid, p_coupon_id uuid)
returns table(qr_token uuid) language plpgsql security definer set search_path = public as $$
declare v_coupon public.coupons%rowtype; v_claim public.member_coupon_claims%rowtype;
begin
  if not exists(select 1 from public.members m where m.id=p_member_id and m.owner_id=p_owner_id and m.status='active') then raise exception 'MEMBER_NOT_FOUND'; end if;
  select * into v_coupon from public.coupons c where c.id=p_coupon_id and c.owner_id=p_owner_id for update;
  if not found or not v_coupon.active or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
    or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) then raise exception 'ITEM_UNAVAILABLE'; end if;
  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then raise exception 'LIMIT_REACHED'; end if;
  if exists(select 1 from public.redemptions r where r.owner_id=p_owner_id and r.member_id=p_member_id and r.coupon_id=p_coupon_id and r.status <> 'cancelled') then raise exception 'ALREADY_USED'; end if;
  select * into v_claim from public.member_coupon_claims c where c.owner_id=p_owner_id and c.member_id=p_member_id and c.coupon_id=p_coupon_id for update;
  if found then
    if v_claim.status='used' then raise exception 'ALREADY_USED'; end if;
    if v_coupon.audience_mode='targeted' and (v_claim.campaign_id is null or not exists(select 1 from public.line_coupon_campaigns lc where lc.id=v_claim.campaign_id and lc.status='sent')) then raise exception 'NOT_ELIGIBLE'; end if;
    update public.member_coupon_claims c set qr_token=gen_random_uuid(), activated_at=now(),
      qr_expires_at=now()+make_interval(mins=>v_coupon.qr_valid_minutes)
      where c.id=v_claim.id returning * into v_claim;
    return query select v_claim.qr_token; return;
  end if;
  if v_coupon.audience_mode='targeted' then raise exception 'NOT_ELIGIBLE'; end if;
  insert into public.member_coupon_claims(owner_id,member_id,coupon_id,activated_at,qr_expires_at)
    values(p_owner_id,p_member_id,p_coupon_id,now(),now()+make_interval(mins=>v_coupon.qr_valid_minutes))
    returning * into v_claim;
  return query select v_claim.qr_token;
end $$;
revoke all on function public.issue_member_coupon_qr(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_member_coupon_qr(uuid,uuid,uuid) to service_role;
