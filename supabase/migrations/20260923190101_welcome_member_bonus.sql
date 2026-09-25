-- Award a configured one-time welcome bonus in the same transaction as member creation.
create function public.award_new_member_welcome_bonus()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  policy jsonb;
  bonus integer;
begin
  if new.owner_id is null or new.points <> 0 then
    return new;
  end if;

  select extra into policy
  from public.store_settings
  where owner_id = new.owner_id;

  if coalesce(policy->>'welcome_bonus_enabled', 'false') <> 'true' then
    return new;
  end if;

  if coalesce(policy->>'welcome_bonus_points', '') !~ '^[0-9]{1,5}$' then
    return new;
  end if;
  bonus := (policy->>'welcome_bonus_points')::integer;
  if bonus < 1 or bonus > 10000 then
    return new;
  end if;

  update public.members
  set points = points + bonus, updated_at = now()
  where id = new.id and owner_id = new.owner_id;

  insert into public.points_transactions
    (owner_id, member_id, sale_amount, points_delta, transaction_type, note)
  values
    (new.owner_id, new.id, 0, bonus, 'adjustment', 'แต้มต้อนรับสมาชิกใหม่');

  insert into public.audit_logs
    (owner_id, actor_id, action, entity_type, entity_id, details)
  values
    (new.owner_id, new.owner_id, 'welcome_bonus', 'member', new.id::text,
     jsonb_build_object('points', bonus));

  return new;
end;
$$;

create trigger members_award_welcome_bonus
after insert on public.members
for each row execute function public.award_new_member_welcome_bonus();
