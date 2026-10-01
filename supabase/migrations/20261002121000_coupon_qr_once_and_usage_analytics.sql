-- Confirming a coupon starts one fixed QR window. Reopening shows the same QR
-- while it is valid; it never extends that window or issues a replacement.
create or replace function public.issue_member_coupon_qr(p_owner_id uuid, p_member_id uuid, p_coupon_id uuid)
returns table(qr_token uuid) language plpgsql security definer set search_path = public as $$
declare v_coupon public.coupons%rowtype; v_claim public.member_coupon_claims%rowtype;
begin
  if not exists(select 1 from public.members m where m.id=p_member_id and m.owner_id=p_owner_id and m.status='active') then raise exception 'MEMBER_NOT_FOUND'; end if;
  select * into v_coupon from public.coupons c where c.id=p_coupon_id and c.owner_id=p_owner_id for update;
  if not found or not v_coupon.active or v_coupon.archived_at is not null
    or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
    or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) then raise exception 'ITEM_UNAVAILABLE'; end if;
  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then raise exception 'LIMIT_REACHED'; end if;
  if exists(select 1 from public.redemptions r where r.owner_id=p_owner_id and r.member_id=p_member_id and r.coupon_id=p_coupon_id and r.status <> 'cancelled') then raise exception 'ALREADY_USED'; end if;
  select * into v_claim from public.member_coupon_claims c where c.owner_id=p_owner_id and c.member_id=p_member_id and c.coupon_id=p_coupon_id for update;
  if found then
    if v_claim.status='used' then raise exception 'ALREADY_USED'; end if;
    if v_coupon.audience_mode='targeted' and (v_claim.campaign_id is null or not exists(select 1 from public.line_coupon_campaigns lc where lc.id=v_claim.campaign_id and lc.status='sent')) then raise exception 'NOT_ELIGIBLE'; end if;
    if v_claim.activated_at is not null then
      if v_claim.qr_expires_at is null or v_claim.qr_expires_at <= now() then raise exception 'QR_EXPIRED'; end if;
      return query select v_claim.qr_token; return;
    end if;
    update public.member_coupon_claims c set activated_at=now(),
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

-- One server round trip returns both the token and the original expiry.
create or replace function public.issue_member_coupon_qr_once(p_owner_id uuid, p_member_id uuid, p_coupon_id uuid)
returns table(qr_token uuid, qr_expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  select issued.qr_token into v_token from public.issue_member_coupon_qr(p_owner_id,p_member_id,p_coupon_id) issued;
  return query select claim.qr_token,claim.qr_expires_at from public.member_coupon_claims claim
    where claim.owner_id=p_owner_id and claim.member_id=p_member_id and claim.coupon_id=p_coupon_id and claim.qr_token=v_token;
end $$;
revoke all on function public.issue_member_coupon_qr_once(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_member_coupon_qr_once(uuid,uuid,uuid) to service_role;

-- Count a coupon in the selected period when its QR was first activated.
create or replace function public.crm_coupon_usage_summary(p_owner_id uuid, p_start date, p_end date)
returns table(coupon_id uuid, title text, opened_count bigint, used_count bigint, expired_count bigint)
language sql stable security definer set search_path = public as $$
  select c.id,c.title,
    count(cl.id) filter (where cl.activated_at is not null) as opened_count,
    count(cl.id) filter (where cl.status='used') as used_count,
    count(cl.id) filter (where cl.status='available' and cl.qr_expires_at < now()) as expired_count
  from public.coupons c
  left join public.member_coupon_claims cl on cl.coupon_id=c.id and cl.owner_id=p_owner_id
    and (cl.activated_at at time zone 'Asia/Bangkok')::date between p_start and p_end
  where c.owner_id=p_owner_id and p_start <= p_end and p_end-p_start <= 366
  group by c.id,c.title
  order by used_count desc,opened_count desc,c.title
$$;
revoke all on function public.crm_coupon_usage_summary(uuid,date,date) from public,anon,authenticated;
grant execute on function public.crm_coupon_usage_summary(uuid,date,date) to service_role;
create index if not exists member_coupon_claims_owner_activated_idx on public.member_coupon_claims(owner_id,activated_at) where activated_at is not null;
