-- History cleanup is not transaction cancellation. Preserve earning totals and
-- game purchase credits, and retain birthday/rank markers against duplicate bonuses.
create table private.points_history_rollups (
 owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
 member_id uuid not null references public.members(id) on delete cascade,
 calendar_year integer not null,
 positive_points bigint not null default 0 check(positive_points>=0),
 primary key(owner_id,member_id,calendar_year)
);
alter table private.points_history_rollups enable row level security;
revoke all on private.points_history_rollups from public,anon,authenticated;

create or replace function private.track_game_purchase() returns trigger language plpgsql security definer set search_path='' as $$
declare src public.points_transactions; program public.game_programs; w public.game_wallets; credit public.game_purchase_credits; v_amount numeric; carry_value numeric:=0; grants integer:=0; awarded integer;
begin
 if TG_OP='DELETE' and current_setting('tammy.history_cleanup',true)=old.owner_id::text then return null;end if;
 if TG_OP='DELETE' then src:=old;else src:=new;end if;
 perform 1 from public.members where id=src.member_id and owner_id=src.owner_id for update;if not found then return null;end if;
 select * into credit from public.game_purchase_credits where source_id=src.id;
 v_amount:=case when TG_OP<>'DELETE' and src.transaction_type='earn' and src.rank_bonus_level is null then greatest(src.sale_amount,0) else 0 end;
 if exists(select 1 from public.transaction_reversals where source_kind='points' and source_id=src.id and cancelled) then v_amount:=0;end if;
 if credit.id is null then
  select * into program from public.game_programs where owner_id=src.owner_id;
  if v_amount<=0 or program.owner_id is null or not program.earning_enabled or TG_OP<>'INSERT' then return null;end if;
  insert into public.game_wallets(owner_id,member_id) values(src.owner_id,src.member_id) on conflict do nothing;
  select * into w from public.game_wallets where member_id=src.member_id for update;
  awarded:=floor((w.carry+v_amount)/program.purchase_threshold);
  insert into public.game_purchase_credits(owner_id,member_id,source_id,amount,threshold,granted) values(src.owner_id,src.member_id,src.id,v_amount,program.purchase_threshold,awarded);
  update public.game_wallets set balance=balance+awarded,carry=w.carry+v_amount-awarded*program.purchase_threshold,updated_at=now() where member_id=src.member_id;
 elsif credit.amount<>v_amount then
  select * into w from public.game_wallets where member_id=src.member_id for update;
  update public.game_purchase_credits set amount=v_amount where id=credit.id;
  -- Replay earning at each original threshold, including carry across purchases.
  -- Spent tickets remain spent; a reversed purchase may create debt until repaid.
  for credit in select * from public.game_purchase_credits where member_id=src.member_id order by id loop
   awarded:=floor((carry_value+credit.amount)/credit.threshold);carry_value:=carry_value+credit.amount-awarded*credit.threshold;grants:=grants+awarded;
   update public.game_purchase_credits set granted=awarded where id=credit.id;
  end loop;
  update public.game_wallets set balance=grants+coalesce((select sum(amount) from public.game_manual_tickets where owner_id=src.owner_id and member_id=src.member_id),0)-w.spent,carry=carry_value,updated_at=now() where member_id=src.member_id;
 end if;
 return null;
end $$;
revoke all on function private.track_game_purchase() from public,anon,authenticated;

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
      earned_this_year := earned_this_year + coalesce((select positive_points from private.points_history_rollups
        where owner_id=shop.owner_id and member_id=member.id and calendar_year=extract(year from current_year_start at time zone 'Asia/Bangkok')::integer),0);
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



create function public.clear_points_history_range(p_owner_id uuid,p_actor_id uuid,p_from timestamptz,p_to timestamptz,p_snapshot timestamptz,p_expected_count bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare total bigint; ids uuid[]; affected integer; prior_flag text;
begin
 if p_owner_id is null or p_actor_id is distinct from p_owner_id
   or not exists(select 1 from auth.users where id=p_actor_id and email_confirmed_at is not null)
   or not exists(select 1 from public.store_settings where owner_id=p_owner_id) then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_snapshot is null or p_expected_count is null
   or p_from>=p_to or p_snapshot>now() or p_expected_count<1 then raise exception 'INVALID_RANGE';end if;
 -- Serialize journal changes while taking a stable, bounded batch. This lock
 -- avoids deleting a record added after the preview and is released at commit.
 -- Follow the same member-before-journal lock order as point awarding.
 perform 1 from public.members m where m.owner_id=p_owner_id and exists(
   select 1 from public.points_transactions t where t.member_id=m.id and t.owner_id=p_owner_id
     and t.created_at>=p_from and t.created_at<p_to and t.created_at<=p_snapshot
     and t.rank_bonus_level is null and t.birthday_bonus_year is null)
   order by m.id for update;
 lock table public.points_transactions in share row exclusive mode;
 select count(*) into total from public.points_transactions
  where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot
    and rank_bonus_level is null and birthday_bonus_year is null;
 if total<>p_expected_count then raise exception 'HISTORY_CHANGED';end if;
 select array_agg(id) into ids from (select id from public.points_transactions
  where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot
    and rank_bonus_level is null and birthday_bonus_year is null order by created_at,id limit 2000) batch;
 insert into private.points_history_rollups(owner_id,member_id,calendar_year,positive_points)
 select owner_id,member_id,extract(year from created_at at time zone 'Asia/Bangkok')::integer,
   sum(greatest(points_delta,0)) from public.points_transactions where owner_id=p_owner_id and id=any(ids)
 group by owner_id,member_id,extract(year from created_at at time zone 'Asia/Bangkok')::integer
 on conflict(owner_id,member_id,calendar_year) do update
   set positive_points=points_history_rollups.positive_points+excluded.positive_points;
 prior_flag:=current_setting('tammy.history_cleanup',true);
 perform set_config('tammy.history_cleanup',p_owner_id::text,true);
 delete from public.points_transactions where owner_id=p_owner_id and id=any(ids);
 get diagnostics affected=row_count;
 perform set_config('tammy.history_cleanup',coalesce(prior_flag,''),true);
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,details)
 values(p_owner_id,p_actor_id,'clear_points_history','points_transactions',
   jsonb_build_object('from',p_from,'to',p_to,'snapshot',p_snapshot,'deleted',affected,'remaining',total-affected));
 return jsonb_build_object('deleted',affected,'remaining',total-affected);
end $$;
revoke all on function public.clear_points_history_range(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.clear_points_history_range(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint) to service_role;
