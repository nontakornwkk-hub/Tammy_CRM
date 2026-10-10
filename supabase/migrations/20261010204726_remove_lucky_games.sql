-- Remove the retired lucky-game feature; preserve ordinary loyalty data.
CREATE OR REPLACE FUNCTION public.transaction_history_rows(p_owner_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_snapshot timestamp with time zone, p_after_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_after_key text DEFAULT NULL::text, p_limit integer DEFAULT 500)
 RETURNS TABLE(history_key text, created_at timestamp with time zone, member_code text, member_name text, line_name text, entry_type text, sale_amount numeric, points_delta integer, description text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with history as (
  select 'points:'||t.id::text as history_key,t.created_at,t.member_id,t.transaction_type as entry_type,t.sale_amount,t.points_delta,t.note as description
   from public.points_transactions t where t.owner_id=p_owner_id
  union all
  select 'redemption:'||r.id::text,r.redeemed_at,r.member_id,case when r.coupon_id is not null then 'coupon' else 'reward' end,
   0::numeric,-r.points_spent,coalesce(c.title,w.title,'รายการแลกสิทธิ์')||' · '||r.status
   from public.redemptions r left join public.coupons c on c.id=r.coupon_id and c.owner_id=p_owner_id
    left join public.rewards w on w.id=r.reward_id and w.owner_id=p_owner_id where r.owner_id=p_owner_id
 union all
 select 'audit:'||a.id::text,a.created_at,null::uuid,'audit',0::numeric,0::integer,a.action||' · '||coalesce(a.details::text,'') from public.audit_logs a where a.owner_id=p_owner_id
 )
 select h.history_key,h.created_at,m.member_code,m.name,m.line_display_name,h.entry_type,h.sale_amount,h.points_delta,h.description
 from history h left join public.members m on m.id=h.member_id and m.owner_id=p_owner_id
 where h.created_at>=p_from and h.created_at<p_to and h.created_at<=p_snapshot
   and (p_after_time is null or (h.created_at,h.history_key)>(p_after_time,p_after_key))
 order by h.created_at,h.history_key limit greatest(1,least(p_limit,500));
$function$
;

CREATE OR REPLACE FUNCTION public.clear_transaction_history_without_audit(p_owner_id uuid, p_actor_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_snapshot timestamp with time zone, p_expected_count bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare point_count bigint; redemption_count bigint; total bigint; removed bigint:=0; ids uuid[]; point_ids uuid[]; point_result jsonb;
begin
 if p_owner_id is null or p_actor_id is distinct from p_owner_id
  or not exists(select 1 from auth.users where id=p_actor_id and email_confirmed_at is not null)
  or not exists(select 1 from public.store_settings where owner_id=p_owner_id) then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_snapshot is null or p_from>=p_to or p_snapshot>now()
  or p_expected_count is null or p_expected_count<1 then raise exception 'INVALID_RANGE';end if;
 -- Match the member-before-journal ordering of award and redemption operations.
 perform 1 from public.members where owner_id=p_owner_id order by id for update;
 lock table public.points_transactions,public.redemptions in share row exclusive mode;
 select count(*) into point_count from public.points_transactions where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot ;
 select count(*) into redemption_count from public.redemptions where owner_id=p_owner_id and redeemed_at>=p_from and redeemed_at<p_to and redeemed_at<=p_snapshot;
 total:=point_count+redemption_count;
 if total<>p_expected_count then raise exception 'HISTORY_CHANGED';end if;
 if point_count>0 then
  select array_agg(id) into point_ids from (select id from public.points_transactions where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot  order by created_at,id limit 2000) batch;
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
 -- Drop detail journals whose source history was cleared, while bonus markers
 -- and coupon claims retain their protection.
 delete from public.transaction_metadata d where d.owner_id=p_owner_id and d.source_kind='points' and d.source_id=any(point_ids);
 delete from public.transaction_reversals d where d.owner_id=p_owner_id and d.source_kind='points' and d.source_id=any(point_ids);
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,details) values(p_owner_id,p_actor_id,'clear_transaction_history','transactions',jsonb_build_object('from',p_from,'to',p_to,'snapshot',p_snapshot,'deleted',removed,'remaining',total-removed));
 return jsonb_build_object('deleted',removed,'remaining',total-removed);
end $function$
;

CREATE OR REPLACE FUNCTION public.clear_transaction_history_range(p_owner_id uuid, p_actor_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_snapshot timestamp with time zone, p_expected_count bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare audit_count bigint; transaction_count bigint; ids bigint[]; result jsonb; removed bigint:=0; remaining bigint:=0;
begin
 if p_owner_id is null or p_actor_id is distinct from p_owner_id
  or not exists(select 1 from auth.users where id=p_actor_id and email_confirmed_at is not null)
  or not exists(select 1 from public.store_settings where owner_id=p_owner_id) then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_snapshot is null or p_from>=p_to or p_snapshot>now()
  or p_expected_count is null or p_expected_count<1 then raise exception 'INVALID_RANGE';end if;
 perform 1 from public.members where owner_id=p_owner_id order by id for update;
 lock table public.points_transactions,public.redemptions,public.audit_logs in share row exclusive mode;
 select count(*) into audit_count from public.audit_logs where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot;
 select sum(n) into transaction_count from (
  select count(*) n from public.points_transactions where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot
  union all select count(*) from public.redemptions where owner_id=p_owner_id and redeemed_at>=p_from and redeemed_at<p_to and redeemed_at<=p_snapshot
 ) counts;
 if transaction_count+audit_count<>p_expected_count then raise exception 'HISTORY_CHANGED';end if;
 select array_agg(id) into ids from (select id from public.audit_logs where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot order by created_at,id limit 2000) batch;
 if transaction_count>0 then
  result:=public.clear_transaction_history_without_audit(p_owner_id,p_actor_id,p_from,p_to,p_snapshot,transaction_count);
  removed:=(result->>'deleted')::bigint;remaining:=(result->>'remaining')::bigint;
 end if;
 delete from public.audit_logs where owner_id=p_owner_id and id=any(ids);
 removed:=removed+coalesce(cardinality(ids),0);remaining:=remaining+audit_count-coalesce(cardinality(ids),0);
 -- Keep one new receipt for this clearing operation, outside the old snapshot.
 insert into public.audit_logs(owner_id,actor_id,action,entity_type,details)
 values(p_owner_id,p_actor_id,'clear_history_including_audit','transactions',jsonb_build_object('from',p_from,'to',p_to,'deleted',removed,'audit_deleted',coalesce(cardinality(ids),0)));
 return jsonb_build_object('deleted',removed,'remaining',remaining);
end $function$
;

-- Remove only triggers attached to retired game functions.
do $cleanup$
declare item record;
begin
 for item in select n.nspname schema,c.relname table_name,t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and p.proname in ('track_game_purchase','reverse_game_purchase') and n.nspname='public' loop
 execute format('drop trigger %I on %I.%I',item.tgname,item.schema,item.table_name);
 end loop;
end $cleanup$;
drop function if exists public.play_crm_game(p_owner uuid, p_member uuid, p_key text, p_request uuid, p_version integer, p_draw integer);
drop function if exists private.reverse_game_purchase();
drop function if exists public.save_crm_game(p_owner uuid, p_actor uuid, p_setup jsonb);
drop function if exists private.track_game_purchase();
drop function if exists public.redeem_game_grant(p_owner uuid, p_actor uuid, p_token uuid, p_sale numeric);
drop function if exists public.toggle_crm_game(p_owner uuid, p_actor uuid, p_key text, p_version integer, p_enabled boolean);
drop function if exists public.give_game_tickets(p_owner uuid, p_actor uuid, p_member uuid, p_request uuid, p_amount integer, p_note text);
drop function if exists public.save_game_program(p_owner uuid, p_actor uuid, p_threshold numeric, p_enabled boolean, p_expected_threshold numeric, p_expected_enabled boolean);
drop function if exists public.clear_game_history(p_owner uuid, p_actor uuid, p_year integer, p_cutoff timestamp with time zone, p_count integer, p_fingerprint text);
drop function if exists public.play_crm_game_test(p_owner uuid, p_member uuid, p_key text, p_request uuid, p_version integer, p_draw integer, p_batch uuid, p_limit integer);
drop table if exists public.game_grants,public.game_plays,public.game_manual_tickets,public.game_purchase_credits,public.game_wallets,public.crm_games,public.game_programs,private.game_history_receipts;
