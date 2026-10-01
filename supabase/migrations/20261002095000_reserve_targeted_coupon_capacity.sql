create function public.reserve_targeted_coupon_capacity()
returns trigger language plpgsql set search_path = public as $$
declare v_coupon public.coupons%rowtype; v_reserved integer;
begin
  if new.campaign_id is null then return new; end if;
  select * into v_coupon from public.coupons c where c.id=new.coupon_id and c.owner_id=new.owner_id for update;
  if not found or v_coupon.audience_mode <> 'targeted' then raise exception 'NOT_ELIGIBLE'; end if;
  if v_coupon.usage_limit is not null then
    select count(*) into v_reserved from public.member_coupon_claims c
      where c.coupon_id=new.coupon_id and c.owner_id=new.owner_id and c.status='available' and c.campaign_id is not null;
    if v_coupon.used_count + v_reserved >= v_coupon.usage_limit then raise exception 'LIMIT_REACHED'; end if;
  end if;
  return new;
end $$;
create trigger targeted_coupon_reservation
before insert on public.member_coupon_claims
for each row execute function public.reserve_targeted_coupon_capacity();
