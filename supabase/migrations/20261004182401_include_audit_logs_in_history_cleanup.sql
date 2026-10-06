-- Same owner/date/snapshot confirmation for audit logs and other history.
alter function public.clear_transaction_history_range(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint) rename to clear_transaction_history_without_audit;
create function public.clear_transaction_history_range(p_owner_id uuid,p_actor_id uuid,p_from timestamptz,p_to timestamptz,p_snapshot timestamptz,p_expected_count bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare audit_count bigint; transaction_count bigint; ids bigint[]; result jsonb; removed bigint:=0; remaining bigint:=0;
begin
 if p_owner_id is null or p_actor_id is distinct from p_owner_id
  or not exists(select 1 from auth.users where id=p_actor_id and email_confirmed_at is not null)
  or not exists(select 1 from public.store_settings where owner_id=p_owner_id) then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_snapshot is null or p_from>=p_to or p_snapshot>now()
  or p_expected_count is null or p_expected_count<1 then raise exception 'INVALID_RANGE';end if;
 perform 1 from public.members where owner_id=p_owner_id order by id for update;
 lock table public.points_transactions,public.redemptions,public.game_plays,public.audit_logs in share row exclusive mode;
 select count(*) into audit_count from public.audit_logs where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot;
 select sum(n) into transaction_count from (
  select count(*) n from public.points_transactions where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot and rank_bonus_level is null and birthday_bonus_year is null
  union all select count(*) from public.redemptions where owner_id=p_owner_id and redeemed_at>=p_from and redeemed_at<p_to and redeemed_at<=p_snapshot
  union all select count(*) from public.game_plays where owner_id=p_owner_id and created_at>=p_from and created_at<p_to and created_at<=p_snapshot
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
end $$;
revoke all on function public.clear_transaction_history_range(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.clear_transaction_history_range(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint) to service_role;
-- Include the logs in the independent CSV backup before the user clears them.
do $migration$
declare definition text; needle text:='from public.game_plays g where g.owner_id=p_owner_id';
begin
 select pg_get_functiondef('public.transaction_history_rows(uuid,timestamptz,timestamptz,timestamptz,timestamptz,text,integer)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'EXPORT_FUNCTION_CHANGED';end if;
 definition:=replace(definition,needle,needle||E'\n union all\n select ''audit:''||a.id::text,a.created_at,null::uuid,''audit'',0::numeric,0::integer,a.action||'' · ''||coalesce(a.details::text,'''') from public.audit_logs a where a.owner_id=p_owner_id');
 execute definition;
end $migration$;
