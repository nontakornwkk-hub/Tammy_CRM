-- Run once per shop and closing year on the shop's chosen Bangkok calendar date.
-- A grace period preserves points earned in the new year.
create or replace function private.expire_year_end_points()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  local_day date := (now() at time zone 'Asia/Bangkok')::date;
  closing_year_value integer := extract(year from (now() at time zone 'Asia/Bangkok'))::integer - 1;
  current_year_start timestamptz := make_timestamptz(extract(year from (now() at time zone 'Asia/Bangkok'))::integer, 1, 1, 0, 0, 0, 'Asia/Bangkok');
  shop record;
  member record;
  claimed_owner uuid;
  affected integer;
  expired integer;
  earned_this_year integer;
  points_to_expire integer;
begin
  for shop in
    select owner_id from public.store_settings
    where extra ->> 'points_expiration' = 'รีทุกสิ้นปี'
      and case when extra ->> 'points_expiration_month' ~ '^(0?[1-9]|1[0-2])$'
        then (extra ->> 'points_expiration_month')::integer else 1 end = extract(month from local_day)::integer
      and case when extra ->> 'points_expiration_day' ~ '^(0?[1-9]|[12][0-9]|3[01])$'
        then (extra ->> 'points_expiration_day')::integer else 1 end = extract(day from local_day)::integer
  loop
    claimed_owner := null;
    affected := 0;
    expired := 0;
    insert into public.point_expiry_runs(owner_id, closing_year)
    values (shop.owner_id, closing_year_value)
    on conflict do nothing
    returning owner_id into claimed_owner;
    if claimed_owner is null then continue; end if;

    for member in
      select id, points from public.members
      where owner_id = shop.owner_id and points > 0
      for update
    loop
      select coalesce(sum(greatest(points_delta, 0)), 0)::integer
      into earned_this_year
      from public.points_transactions
      where owner_id = shop.owner_id and member_id = member.id
        and created_at >= current_year_start;
      points_to_expire := greatest(0, member.points - earned_this_year);
      if points_to_expire = 0 then continue; end if;

      update public.members set points = points - points_to_expire, updated_at = now()
      where id = member.id;
      insert into public.points_transactions
        (owner_id, member_id, sale_amount, points_delta, transaction_type, note)
      values
        (shop.owner_id, member.id, 0, -points_to_expire, 'adjustment',
         'รีเซ็ตแต้มจากปี ' || closing_year_value::text);
      affected := affected + 1;
      expired := expired + points_to_expire;
    end loop;

    update public.point_expiry_runs
    set members_affected = affected, points_expired = expired
    where owner_id = shop.owner_id and closing_year = closing_year_value;
    insert into public.audit_logs
      (owner_id, actor_id, action, entity_type, details)
    values
      (shop.owner_id, shop.owner_id, 'expire_year_end_points', 'store',
       pg_catalog.jsonb_build_object('closing_year', closing_year_value, 'members_affected', affected, 'points_expired', expired));
  end loop;
end;
$$;
revoke all on function private.expire_year_end_points() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'tammy-year-end-points') then
    perform cron.unschedule('tammy-year-end-points');
  end if;
  perform cron.schedule('tammy-year-end-points', '5 17 * * *',
    'select private.expire_year_end_points();');
end $$;
