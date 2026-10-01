create function public.prevent_sent_coupon_audience_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.audience_mode = 'targeted' and new.audience_mode <> old.audience_mode
    and exists(select 1 from public.line_coupon_campaigns c where c.coupon_id=old.id and c.status in ('sending','sent'))
  then raise exception 'คูปองที่เริ่มส่งให้กลุ่มลูกค้าแล้วต้องคงสิทธิ์เฉพาะผู้รับ'; end if;
  return new;
end $$;
create trigger coupons_keep_targeted_audience
before update of audience_mode on public.coupons
for each row execute function public.prevent_sent_coupon_audience_change();
