-- Allow account deletion without removing historic POS sale records.
alter table public.pos_sales drop constraint pos_sales_member_id_fkey;
alter table public.pos_sales alter column member_id drop not null;
alter table public.pos_sales add constraint pos_sales_member_id_fkey
  foreign key (member_id) references public.members(id) on delete set null;

-- Small receipts still count toward spending, even when they earn zero points.
create or replace function public.pos_record_sale(
  p_owner_id uuid,
  p_member_id uuid,
  p_external_sale_id text,
  p_sale_amount numeric,
  p_note text default ''
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_existing public.pos_sales%rowtype;
  v_member public.members%rowtype;
  v_updated public.members%rowtype;
  v_sale public.pos_sales%rowtype;
  v_previous_sub text;
begin
  if p_owner_id is null or p_member_id is null or p_external_sale_id is null
    or p_external_sale_id !~ '^[A-Za-z0-9._:-]{1,120}$'
    or p_sale_amount is null or p_sale_amount <= 0 or p_sale_amount > 9999999999.99
    or p_sale_amount <> round(p_sale_amount, 2)
    or length(coalesce(p_note, '')) > 200 then
    raise exception 'INVALID_POS_SALE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text || ':' || p_external_sale_id, 0)
  );
  select * into v_existing from public.pos_sales
    where owner_id = p_owner_id and external_sale_id = p_external_sale_id;
  if found then
    if v_existing.member_id is distinct from p_member_id
      or v_existing.sale_amount <> p_sale_amount
      or v_existing.note <> coalesce(p_note, '') then
      raise exception 'POS_SALE_ID_REUSED';
    end if;
    return jsonb_build_object(
      'saleId', v_existing.id, 'externalSaleId', v_existing.external_sale_id,
      'memberId', v_existing.member_id, 'saleAmount', v_existing.sale_amount,
      'pointsAwarded', v_existing.points_awarded,
      'pointsBalance', v_existing.member_points_after,
      'level', v_existing.member_level_after,
      'totalSpending', v_existing.member_spending_after,
      'createdAt', v_existing.created_at, 'replayed', true
    );
  end if;

  select * into v_member from public.members
    where id = p_member_id and owner_id = p_owner_id and status = 'active' for update;
  if not found then raise exception 'POS_MEMBER_NOT_FOUND'; end if;

  v_previous_sub := current_setting('request.jwt.claim.sub', true);
  perform pg_catalog.set_config('request.jwt.claim.sub', p_owner_id::text, true);
  begin
    v_updated := public.award_points(p_member_id, p_sale_amount, 0,
      'POS ' || p_external_sale_id ||
      case when coalesce(p_note, '') = '' then '' else ' · ' || p_note end);
  exception when raise_exception then
    if sqlerrm <> 'Purchase does not earn points' then raise; end if;
    update public.members set spending = spending + p_sale_amount,
      last_visit = (now() at time zone 'Asia/Bangkok')::date, updated_at = now()
      where id = p_member_id and owner_id = p_owner_id returning * into v_updated;
    insert into public.points_transactions
      (owner_id, member_id, sale_amount, points_delta, transaction_type, note)
    values (p_owner_id, p_member_id, p_sale_amount, 0, 'earn',
      'POS ' || p_external_sale_id ||
      case when coalesce(p_note, '') = '' then '' else ' · ' || p_note end);
    insert into public.audit_logs
      (owner_id, actor_id, action, entity_type, entity_id, details)
    values (p_owner_id, p_owner_id, 'pos_sale_no_points', 'member', p_member_id::text,
      jsonb_build_object('external_sale_id', p_external_sale_id, 'sale', p_sale_amount));
  end;
  perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);

  insert into public.pos_sales (
    owner_id, external_sale_id, member_id, sale_amount, note,
    points_awarded, member_points_after, member_level_after, member_spending_after
  ) values (
    p_owner_id, p_external_sale_id, p_member_id, p_sale_amount, coalesce(p_note, ''),
    v_updated.points - v_member.points, v_updated.points, v_updated.level, v_updated.spending
  ) returning * into v_sale;

  return jsonb_build_object(
    'saleId', v_sale.id, 'externalSaleId', v_sale.external_sale_id,
    'memberId', v_sale.member_id, 'saleAmount', v_sale.sale_amount,
    'pointsAwarded', v_sale.points_awarded,
    'pointsBalance', v_sale.member_points_after, 'level', v_sale.member_level_after,
    'totalSpending', v_sale.member_spending_after,
    'createdAt', v_sale.created_at, 'replayed', false
  );
end;
$$;
revoke all on function public.pos_record_sale(uuid,uuid,text,numeric,text) from public, anon, authenticated;
grant execute on function public.pos_record_sale(uuid,uuid,text,numeric,text) to service_role;
