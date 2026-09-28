create or replace function public.redeem_line_member_item(
  p_owner_id uuid, p_member_id uuid, p_item_id uuid, p_kind text
) returns table(redemption_id uuid, remaining_points integer)
language plpgsql security invoker set search_path = '' as $$
declare
  v_member public.members%rowtype;
  v_reward public.rewards%rowtype;
  v_coupon public.coupons%rowtype;
  v_id uuid;
begin
  if p_kind not in ('reward', 'coupon') then raise exception 'INVALID_KIND'; end if;
  select * into v_member from public.members
    where id = p_member_id and owner_id = p_owner_id and status = 'active' for update;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if p_kind = 'reward' then
    select * into v_reward from public.rewards where id = p_item_id and owner_id = p_owner_id for update;
    if not found or not v_reward.active or (v_reward.starts_at is not null and v_reward.starts_at > now())
      or (v_reward.ends_at is not null and v_reward.ends_at < now()) then raise exception 'ITEM_UNAVAILABLE'; end if;
    if v_reward.stock is not null and v_reward.stock <= 0 then raise exception 'OUT_OF_STOCK'; end if;
    if v_member.points < v_reward.points_cost then raise exception 'NOT_ENOUGH_POINTS'; end if;
    update public.members set points = points - v_reward.points_cost, updated_at = now() where id = p_member_id;
    if v_reward.stock is not null then update public.rewards set stock = stock - 1, updated_at = now() where id = p_item_id; end if;
    insert into public.redemptions(owner_id, member_id, reward_id, points_spent, status)
      values (p_owner_id, p_member_id, p_item_id, v_reward.points_cost, 'completed') returning id into v_id;
    if v_reward.points_cost > 0 then
      insert into public.points_transactions(owner_id, member_id, points_delta, transaction_type, note)
        values (p_owner_id, p_member_id, -v_reward.points_cost, 'redeem', 'แลกของรางวัล: ' || v_reward.title);
    end if;
  else
    select * into v_coupon from public.coupons where id = p_item_id and owner_id = p_owner_id for update;
    if not found or not v_coupon.active or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
      or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) then raise exception 'ITEM_UNAVAILABLE'; end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then raise exception 'LIMIT_REACHED'; end if;
    if exists (select 1 from public.redemptions where owner_id = p_owner_id and member_id = p_member_id
      and coupon_id = p_item_id and status <> 'cancelled') then raise exception 'ALREADY_USED'; end if;
    update public.coupons set used_count = used_count + 1, updated_at = now() where id = p_item_id;
    insert into public.redemptions(owner_id, member_id, coupon_id, points_spent, status)
      values (p_owner_id, p_member_id, p_item_id, 0, 'completed') returning id into v_id;
  end if;
  return query select v_id, (select m.points from public.members m where m.id = p_member_id);
end $$;

revoke all on function public.redeem_line_member_item(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_line_member_item(uuid, uuid, uuid, text) to service_role;
