-- Snapshots are captured only for future transactions; legacy values stay unknown.
create table public.transaction_metadata (
  source_kind text not null check(source_kind in ('points','redemption')),
  source_id uuid not null,
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  points_before integer,points_after integer,
  primary key(source_kind,source_id)
);
alter table public.transaction_metadata enable row level security;
revoke all on public.transaction_metadata from public,anon,authenticated;
grant select on public.transaction_metadata to authenticated;
create policy transaction_metadata_read on public.transaction_metadata for select to authenticated
using ((select public.crm_team_can(owner_id,'points_read')));
create function private.capture_transaction_metadata() returns trigger
language plpgsql security definer set search_path='' as $$
declare balance integer; before_value integer; after_value integer; kind text;
begin
  if new.owner_id is null then return null; end if;
  select points into balance from public.members where id=new.member_id and owner_id=new.owner_id;
  if tg_table_name='points_transactions' then
    kind:='points';
    if new.rank_bonus_level is not null then before_value:=balance;after_value:=balance+new.points_delta;
    elsif new.transaction_type in ('earn','redeem') then after_value:=balance;before_value:=balance-new.points_delta;
    else before_value:=null;after_value:=null;end if;
  else kind:='redemption';after_value:=balance;before_value:=balance+new.points_spent;end if;
  insert into public.transaction_metadata(source_kind,source_id,owner_id,actor_id,points_before,points_after)
    values(kind,new.id,new.owner_id,auth.uid(),before_value,after_value);
  return null;
end $$;
revoke all on function private.capture_transaction_metadata() from public,anon,authenticated;
create trigger points_capture_metadata after insert on public.points_transactions for each row execute function private.capture_transaction_metadata();
create trigger redemption_capture_metadata after insert on public.redemptions for each row execute function private.capture_transaction_metadata();
