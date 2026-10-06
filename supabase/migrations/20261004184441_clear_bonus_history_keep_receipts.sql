-- Compact anti-duplicate keys survive; visible bonus transaction history does not.
create table private.member_bonus_receipts(
 owner_id uuid not null references auth.users(id) on delete cascade,
 member_id uuid not null references public.members(id) on delete cascade,
 bonus_kind text not null check(bonus_kind in ('rank','birthday')),
 bonus_key text not null,
 primary key(owner_id,member_id,bonus_kind,bonus_key)
);
alter table private.member_bonus_receipts enable row level security;
revoke all on private.member_bonus_receipts from public,anon,authenticated;
create function private.keep_bonus_receipt() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('tammy.history_cleanup',true)=old.owner_id::text then
  if old.rank_bonus_level is not null then
   insert into private.member_bonus_receipts values(old.owner_id,old.member_id,'rank',old.rank_bonus_level) on conflict do nothing;
  end if;
  if old.birthday_bonus_year is not null then
   insert into private.member_bonus_receipts values(old.owner_id,old.member_id,'birthday',old.birthday_bonus_year::text) on conflict do nothing;
  end if;
 end if;
 return old;
end $$;
revoke all on function private.keep_bonus_receipt() from public,anon,authenticated;
create trigger keep_bonus_receipt before delete on public.points_transactions for each row execute function private.keep_bonus_receipt();
create function private.prevent_archived_bonus_repeat() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.member_bonus_receipts r where r.owner_id=new.owner_id and r.member_id=new.member_id
  and ((r.bonus_kind='rank' and r.bonus_key=new.rank_bonus_level) or (r.bonus_kind='birthday' and r.bonus_key=new.birthday_bonus_year::text))) then return null;end if;
 return new;
end $$;
revoke all on function private.prevent_archived_bonus_repeat() from public,anon,authenticated;
create trigger prevent_archived_bonus_repeat before insert on public.points_transactions for each row execute function private.prevent_archived_bonus_repeat();

do $migration$
declare signature text; definition text;
begin
 foreach signature in array array[
 'public.clear_points_history_range(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint)',
 'public.clear_transaction_history_without_audit(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint)',
 'public.clear_transaction_history_range(uuid,uuid,timestamptz,timestamptz,timestamptz,bigint)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  if definition !~ 'rank_bonus_level is null' then raise exception 'CLEANUP_FUNCTION_CHANGED';end if;
  definition:=regexp_replace(definition,'and (t\.)?rank_bonus_level is null and (t\.)?birthday_bonus_year is null','','g');
  execute definition;
 end loop;
 select pg_get_functiondef('public.award_points(uuid,numeric,integer,text)'::regprocedure) into definition;
 if position(') into claimed;' in definition)=0 then raise exception 'AWARD_FUNCTION_CHANGED';end if;
 definition:=replace(definition,') into claimed;',E') into claimed;\n  claimed:=claimed or exists(select 1 from private.member_bonus_receipts r where r.owner_id=m.owner_id and r.member_id=m.id and r.bonus_kind=''birthday'' and r.bonus_key=extract(year from today_bkk)::integer::text);');
 execute definition;
end $migration$;
-- Broadcast an owner-scoped refresh hint; do not publish transaction details.
do $realtime$
begin
 if to_regprocedure('private.signal_coupon_usage_change()') is not null then
  create trigger points_history_usage_change after insert or update or delete on public.points_transactions for each row execute function private.signal_coupon_usage_change();
  create trigger audit_history_usage_change after insert or delete on public.audit_logs for each row execute function private.signal_coupon_usage_change();
 end if;
end $realtime$;
