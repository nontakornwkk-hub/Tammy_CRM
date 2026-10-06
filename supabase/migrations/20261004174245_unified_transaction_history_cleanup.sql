-- One timeline for points, coupons, reward redemptions and game results.
-- Claim/grant state is operational data, not disposable history.
create function public.transaction_history_rows(p_owner_id uuid,p_from timestamptz,p_to timestamptz,p_snapshot timestamptz,p_after_time timestamptz default null,p_after_key text default null,p_limit integer default 500)
returns table(history_key text,created_at timestamptz,member_code text,member_name text,line_name text,entry_type text,sale_amount numeric,points_delta integer,description text)
language sql security definer set search_path='' as $$
 with history as (
  select 'points:'||t.id::text as history_key,t.created_at,t.member_id,t.transaction_type as entry_type,t.sale_amount,t.points_delta,t.note as description
   from public.points_transactions t where t.owner_id=p_owner_id
  union all
  select 'redemption:'||r.id::text,r.redeemed_at,r.member_id,case when r.coupon_id is not null then 'coupon' else 'reward' end,
   0::numeric,-r.points_spent,coalesce(c.title,w.title,'รายการแลกสิทธิ์')||' · '||r.status
   from public.redemptions r left join public.coupons c on c.id=r.coupon_id and c.owner_id=p_owner_id
    left join public.rewards w on w.id=r.reward_id and w.owner_id=p_owner_id where r.owner_id=p_owner_id
  union all
  select 'game:'||g.id::text,g.created_at,g.member_id,'game',0::numeric,case when g.prize->>'kind'='points' then coalesce((g.prize->>'points')::integer,0) else 0 end,
    coalesce(g.prize->>'title','รางวัลเกม')||' · '||g.game_key from public.game_plays g where g.owner_id=p_owner_id
 )
 select h.history_key,h.created_at,m.member_code,m.name,m.line_display_name,h.entry_type,h.sale_amount,h.points_delta,h.description
 from history h left join public.members m on m.id=h.member_id and m.owner_id=p_owner_id
 where h.created_at>=p_from and h.created_at<p_to and h.created_at<=p_snapshot
   and (p_after_time is null or (h.created_at,h.history_key)>(p_after_time,p_after_key))
 order by h.created_at,h.history_key limit greatest(1,least(p_limit,500));
$$;
revoke all on function public.transaction_history_rows(uuid,timestamptz,timestamptz,timestamptz,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function public.transaction_history_rows(uuid,timestamptz,timestamptz,timestamptz,timestamptz,text,integer) to service_role;

create function public.clear_transaction_history_range(p_owner_id uuid,p_actor_id uuid,p_from timestamptz,p_to timestamptz,p_snapshot timestamptz,p_expected_count bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare point_count bigint; redemption_count bigint; game_count bigint; total bigint; removed bigint:=0; ids uuid[]; point_ids uuid[]; point_result jsonb;
begin
 if p_owner_id is null or p_actor_id is distinct from p_owner_id
  or not exists(select 1 from auth.users where id=p_actor_id and email_confirmed_at is not null)
  or not exists(select 1 from public.store_settings where owner_id=p_owner_id) then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_snapshot is null or p_from>=p_to or p_snapshot>now()
  or p_expected_count is null or p_expected_count<1 then raise exception 'INVALID_RANGE';end if;
 -- Match the member-before-journal ordering of award and redemption operations.
 perform 1 from public.members where owner_id=p_owner_id order by id for update;
 lock table public.points_transactions,public.redemptions,public.game_plays in share row exclusive mode;
 select count(*) into point_count from public.points_transactions where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot and rank_bonus_level is null and birthday_bonus_year is null;
 select count(*) into redemption_count from public.redemptions where owner_id=p_owner_id and redeemed_at>=p_from and redeemed_at<p_to and redeemed_at<=p_snapshot;
 select count(*) into game_count from public.game_plays where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot;
 total:=point_count+redemption_count+game_count;
 if total<>p_expected_count then raise exception 'HISTORY_CHANGED';end if;
 if point_count>0 then
  select array_agg(id) into point_ids from (select id from public.points_transactions where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot and rank_bonus_level is null and birthday_bonus_year is null order by created_at,id limit 2000) batch;
  point_result:=public.clear_points_history_range(p_owner_id,p_actor_id,p_from,p_to,p_snapshot,point_count);
  removed:=(point_result->>'deleted')::bigint;
 end if;
 select array_agg(id) into ids from (select id from public.redemptions where owner_id=p_owner_id and redeemed_at>=p_from and redeemed_at<p_to and redeemed_at<=p_snapshot order by redeemed_at,id limit 2000) batch;
 if ids is not null then
  -- A completed coupon stays spent even after its history row is removed.
  -- Existing issued claims already hold this state; legacy records get a guard.
  insert into public.member_coupon_claims(owner_id,member_id,coupon_id,status,used_at)
   select distinct on (r.member_id,r.coupon_id) r.owner_id,r.member_id,r.coupon_id,'used',r.redeemed_at
   from public.redemptions r where r.owner_id=p_owner_id and r.id=any(ids) and r.coupon_id is not null and r.status<>'cancelled'
    and not coalesce((select v.rights_restored from public.transaction_reversals v where v.owner_id=p_owner_id and v.source_kind='redemption' and v.source_id=r.id),false)
   order by r.member_id,r.coupon_id,r.redeemed_at desc
   on conflict(owner_id,coupon_id,member_id) do update set status='used',used_at=excluded.used_at;
  delete from public.transaction_metadata where owner_id=p_owner_id and source_kind='redemption' and source_id=any(ids);
  delete from public.transaction_reversals where owner_id=p_owner_id and source_kind='redemption' and source_id=any(ids);
  delete from public.redemptions where owner_id=p_owner_id and id=any(ids);
  removed:=removed+cardinality(ids);
 end if;
 select array_agg(id) into ids from (select id from public.game_plays where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot order by created_at,id limit 2000) batch;
 if ids is not null then
  -- Detach actual rewards first; never cascade away an unclaimed prize.
  insert into private.game_history_receipts(owner_id,member_id,request_id)
   select owner_id,member_id,request_id from public.game_plays where owner_id=p_owner_id and id=any(ids) on conflict do nothing;
  update public.game_grants set play_id=null where owner_id=p_owner_id and play_id=any(ids);
  delete from public.game_plays where owner_id=p_owner_id and id=any(ids);
  removed:=removed+cardinality(ids);
 end if;
 -- Drop detail journals whose source history was cleared, while bonus markers
 -- and operational wallets/claims/grants retain their protection.
 delete from public.transaction_metadata d where d.owner_id=p_owner_id and d.source_kind='points' and d.source_id=any(point_ids);
 delete from public.transaction_reversals d where d.owner_id=p_owner_id and d.source_kind='points' and d.source_id=any(point_ids);
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,details) values(p_owner_id,p_actor_id,'clear_transaction_history','transactions',jsonb_build_object('from',p_from,'to',p_to,'snapshot',p_snapshot,'deleted',removed,'remaining',total-removed));
 return jsonb_build_object('deleted',removed,'remaining',total-removed);
end $$;
revoke all on function public.clear_transaction_history_range(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.clear_transaction_history_range(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint) to service_role;
