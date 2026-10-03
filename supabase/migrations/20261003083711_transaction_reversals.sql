-- Privileged, atomic reversal journal. Original transactions are retained.
create table public.transaction_reversals (
  source_kind text not null check(source_kind in ('points','redemption')),
  source_id uuid not null,
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  points_refunded boolean not null default false,
  rights_restored boolean not null default false,
  cancelled boolean not null default false,
  primary key(source_kind,source_id)
);
alter table public.transaction_reversals enable row level security;
revoke all on public.transaction_reversals from public,anon,authenticated;
grant select on public.transaction_reversals to authenticated;
create policy transaction_reversals_read on public.transaction_reversals for select to authenticated
using ((select public.crm_team_can(owner_id,'points_read')));

create function public.reverse_crm_transaction(p_owner_id uuid,p_actor_id uuid,p_kind text,p_id uuid,p_action text,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  t public.points_transactions; r public.redemptions; m public.members;
  journal public.transaction_reversals; v_member_id uuid; delta integer:=0;
  total integer; bonus_ids uuid[]; policy jsonb; previous_level text;
  restore_rights boolean; refund_points boolean; source jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'FORBIDDEN'; end if;
  if p_actor_id is null or not exists(select 1 from auth.users where id=p_actor_id and email_confirmed_at is not null)
    or not (p_actor_id=p_owner_id or exists(select 1 from public.team_accounts where owner_id=p_owner_id and user_id=p_actor_id and active and approved_at is not null and role='manager')) then raise exception 'FORBIDDEN'; end if;
  if p_kind not in ('points','redemption') or p_action not in ('cancel','refund_points','restore_rights')
    or length(btrim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'INVALID_REQUEST'; end if;
  if p_kind='points' then
    select member_id into v_member_id from public.points_transactions where id=p_id and owner_id=p_owner_id;
  else
    select member_id into v_member_id from public.redemptions where id=p_id and owner_id=p_owner_id;
  end if;
  if v_member_id is null then raise exception 'NOT_FOUND'; end if;
  -- Serialize all balance changes for this member before locking the source.
  select * into m from public.members where id=v_member_id and owner_id=p_owner_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  insert into public.transaction_reversals(source_kind,source_id,owner_id) values(p_kind,p_id,p_owner_id) on conflict do nothing;
  select * into journal from public.transaction_reversals where source_kind=p_kind and source_id=p_id for update;
  if journal.cancelled then raise exception 'ALREADY_REVERSED'; end if;
  if p_kind='points' then
    select * into t from public.points_transactions where id=p_id and owner_id=p_owner_id for update;
    if t.transaction_type<>'earn' or t.sale_amount<=0 or p_action<>'cancel' then raise exception 'ACTION_UNAVAILABLE'; end if;
    if (select count(*) from public.points_transactions where owner_id=p_owner_id and member_id=m.id and created_at=t.created_at and transaction_type='earn')<>1 then raise exception 'AMBIGUOUS_TRANSACTION'; end if;
    select coalesce(sum(points_delta),0),array_agg(id) into total,bonus_ids from public.points_transactions
      where owner_id=p_owner_id and member_id=m.id and created_at=t.created_at and rank_bonus_level is not null;
    total:=total+t.points_delta; delta:=-total;
    if m.points+delta<0 or m.spending<t.sale_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;
    source:=to_jsonb(t);
    select extra into policy from public.store_settings where owner_id=p_owner_id;
    select details->>'old_level' into previous_level from public.audit_logs where owner_id=p_owner_id and entity_id=m.id::text
      and action='award_points' and created_at=t.created_at order by id desc limit 1;
    update public.members set points=points+delta,spending=spending-t.sale_amount,
      level=case when spending-t.sale_amount>=greatest(coalesce((policy->>'platinum_min_spend')::numeric,20000),coalesce((policy->>'gold_min_spend')::numeric,5000)+1) then 'Platinum'
        when spending-t.sale_amount>=greatest(1,coalesce((policy->>'gold_min_spend')::numeric,5000)) then 'Gold'
        when previous_level='Silver' or level='Silver' then 'Silver' else 'Member' end,
      last_visit=(select max((h.created_at at time zone 'Asia/Bangkok')::date) from public.points_transactions h
        where h.owner_id=p_owner_id and h.member_id=m.id and h.transaction_type='earn' and h.sale_amount>0 and h.id<>t.id
          and not exists(select 1 from public.transaction_reversals j where j.source_kind='points' and j.source_id=h.id and j.cancelled)),
      updated_at=now() where id=m.id;
    -- Release eligibility markers, retaining their original values in the audit.
    source:=source||jsonb_build_object('rank_bonuses',coalesce((select jsonb_agg(to_jsonb(b)) from public.points_transactions b where id=any(bonus_ids)),'[]'::jsonb));
    update public.points_transactions set birthday_bonus_year=null where id=t.id;
    update public.points_transactions set rank_bonus_level=null where id=any(bonus_ids);
    insert into public.transaction_reversals(source_kind,source_id,owner_id,cancelled)
      select 'points',b,p_owner_id,true from unnest(bonus_ids) b on conflict(source_kind,source_id) do nothing;
    update public.transaction_reversals set cancelled=true where source_kind=p_kind and source_id=p_id;
  else
    select * into r from public.redemptions where id=p_id and owner_id=p_owner_id for update;
    if r.status='cancelled' and not journal.rights_restored then raise exception 'ALREADY_REVERSED'; end if;
    source:=to_jsonb(r);
    refund_points:=p_action in ('cancel','refund_points') and r.points_spent>0 and not journal.points_refunded;
    restore_rights:=p_action in ('cancel','restore_rights') and not journal.rights_restored;
    if not refund_points and not restore_rights then raise exception 'ACTION_UNAVAILABLE'; end if;
    if p_action='refund_points' and not refund_points then raise exception 'ACTION_UNAVAILABLE'; end if;
    if p_action='restore_rights' and not restore_rights then raise exception 'ACTION_UNAVAILABLE'; end if;
    if refund_points then
      delta:=r.points_spent;
      update public.members set points=points+delta,updated_at=now() where id=m.id;
    end if;
    if restore_rights then
      if r.reward_id is not null then
        update public.rewards set stock=case when stock is null then null else stock+1 end,updated_at=now()
          where id=r.reward_id and owner_id=p_owner_id;
      else
        -- Invalidate the previous QR before making the entitlement available again.
        update public.member_coupon_claims set status='available',used_at=null,activated_at=null,qr_expires_at=null,qr_token=gen_random_uuid()
          where owner_id=p_owner_id and member_id=m.id and coupon_id=r.coupon_id and status='used';
        update public.coupons set used_count=greatest(0,used_count-1),updated_at=now() where id=r.coupon_id and owner_id=p_owner_id;
      end if;
      update public.redemptions set status='cancelled' where id=r.id;
    end if;
    update public.transaction_reversals set points_refunded=points_refunded or refund_points,
      rights_restored=rights_restored or restore_rights,cancelled=p_action='cancel' or ((points_refunded or refund_points or r.points_spent=0) and (rights_restored or restore_rights))
      where source_kind=p_kind and source_id=p_id;
  end if;
  if delta<>0 then
    insert into public.points_transactions(owner_id,member_id,points_delta,transaction_type,note)
      values(p_owner_id,m.id,delta,'adjustment',case p_action when 'cancel' then 'ยกเลิกรายการ' else 'คืนแต้ม' end||' ['||p_id::text||'] · '||btrim(p_reason));
  end if;
  insert into public.audit_logs(owner_id,actor_id,action,entity_type,entity_id,details)
    values(p_owner_id,p_actor_id,'transaction_'||p_action,p_kind,p_id::text,jsonb_build_object('reason',btrim(p_reason),'original',source,'points_before',m.points,'points_after',m.points+delta,'delta',delta));
  return jsonb_build_object('points_before',m.points,'points_after',m.points+delta,'delta',delta);
end $$;
revoke all on function public.reverse_crm_transaction(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reverse_crm_transaction(uuid,uuid,text,uuid,text,text) to service_role;
