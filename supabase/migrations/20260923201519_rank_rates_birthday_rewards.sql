-- Customer birthday is optional. Existing members are not backfilled.
alter table public.members add column birth_date date;
alter table public.members drop constraint members_level_check;
alter table public.members add constraint members_level_check check (level in ('Member', 'Silver', 'Gold', 'Platinum'));

-- A purchase can claim one birthday bonus per member per Bangkok calendar year.
alter table public.points_transactions add column birthday_bonus_year integer;
alter table public.points_transactions add column rank_bonus_level text
  check (rank_bonus_level in ('Gold', 'Platinum'));
create unique index points_one_birthday_bonus_per_year
  on public.points_transactions(member_id, birthday_bonus_year)
  where birthday_bonus_year is not null;
create unique index points_one_rank_bonus_per_level
  on public.points_transactions(member_id, rank_bonus_level)
  where rank_bonus_level is not null;

-- Replaces the old client-supplied point amount with an authoritative calculation.
create or replace function public.award_points(
  target_member_id uuid, sale numeric, earned integer, memo text default ''
) returns public.members
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  m public.members;
  original_level text;
  next_level text;
  policy jsonb;
  base_rate integer;
  base_earned integer;
  rate integer;
  base_points integer;
  best_bonus integer := 0;
  candidate integer;
  best_kind text := '';
  promo jsonb;
  today_bkk date := (now() at time zone 'Asia/Bangkok')::date;
  claimed boolean;
  birthday_year integer;
  gold_threshold numeric;
  platinum_threshold numeric;
  gold_bonus integer;
  platinum_bonus integer;
  total_earned integer;
  bonus_id uuid;
begin
  if u is null or sale is null or sale <= 0 then
    raise exception 'Invalid transaction';
  end if;
  select * into m from public.members
  where id = target_member_id and owner_id = u
  for update;
  if m.id is null then raise exception 'Member not found'; end if;

  select points_spend, points_earned, extra
  into base_rate, base_earned, policy
  from public.store_settings where owner_id = u;
  if not found then raise exception 'Store settings not found'; end if;
  if coalesce(policy->>'accumulation_enabled', 'true') = 'false' then
    raise exception 'Points accumulation is disabled';
  end if;
  original_level := m.level;
  rate := case m.level
    when 'Gold' then coalesce((policy->>'gold_baht_per_point')::integer, 45)
    when 'Platinum' then coalesce((policy->>'platinum_baht_per_point')::integer, 40)
    else base_rate end;
  if rate < 1 or base_earned < 1 then raise exception 'Invalid points settings'; end if;
  base_points := floor(sale / rate)::integer *
    case when m.level in ('Gold', 'Platinum') then 1 else base_earned end;
  select exists (
    select 1 from public.points_transactions
    where member_id = m.id and birthday_bonus_year = extract(year from today_bkk)::integer
  ) into claimed;

  for promo in select value from jsonb_array_elements(
    case when jsonb_typeof(policy->'promotions') = 'array'
      then policy->'promotions' else '[]'::jsonb end
  ) as p(value) loop
    if coalesce(promo->>'enabled', 'false') <> 'true'
      or sale < coalesce((promo->>'minSpend')::numeric, 0) then continue; end if;
    if promo->>'type' = 'birthday' then
      if m.birth_date is null or extract(month from m.birth_date) <> extract(month from today_bkk)
        or claimed then continue; end if;
    elsif coalesce(promo->>'startsOn', '') > today_bkk::text
      or coalesce(promo->>'endsOn', '') < today_bkk::text
      or coalesce(promo->>'startsOn', '') = '' then continue;
    end if;
    candidate := case promo->>'type'
      when 'multiplier' then greatest(0, floor(base_points * greatest(1, coalesce((promo->>'multiplier')::numeric, 1)))::integer - base_points)
      when 'threshold' then greatest(0, coalesce((promo->>'bonusPoints')::integer, 0))
      when 'birthday' then greatest(0, coalesce((promo->>'bonusPoints')::integer, 0))
      when 'new_member' then case when
        today_bkk - (m.created_at at time zone 'Asia/Bangkok')::date
        between 0 and greatest(1, coalesce((promo->>'newMemberDays')::integer, 30))
        then greatest(0, coalesce((promo->>'bonusPoints')::integer, 0)) else 0 end
      when 'repeat' then case when coalesce((promo->>'stepSpend')::numeric, 0) > 0
        then floor(sale / (promo->>'stepSpend')::numeric)::integer *
          greatest(0, coalesce((promo->>'bonusPoints')::integer, 0)) else 0 end
      else 0 end;
    if candidate > best_bonus then
      best_bonus := candidate;
      best_kind := promo->>'type';
    end if;
  end loop;

  total_earned := base_points + best_bonus;
  gold_threshold := greatest(1, coalesce((policy->>'gold_min_spend')::numeric, 5000));
  platinum_threshold := greatest(gold_threshold + 1, coalesce((policy->>'platinum_min_spend')::numeric, 20000));
  gold_bonus := greatest(0, coalesce((policy->>'gold_upgrade_bonus')::integer, 15));
  platinum_bonus := greatest(0, coalesce((policy->>'platinum_upgrade_bonus')::integer, 30));
  next_level := case
    when m.level = 'Platinum' or m.spending + sale >= platinum_threshold then 'Platinum'
    when m.level = 'Gold' or m.spending + sale >= gold_threshold then 'Gold'
    else m.level end;
  if total_earned <= 0 and next_level = original_level then
    raise exception 'Purchase does not earn points';
  end if;
  birthday_year := case when best_kind = 'birthday'
    then extract(year from today_bkk)::integer else null end;

  update public.members set
    points = points + total_earned,
    spending = spending + sale,
    level = next_level,
    last_visit = today_bkk,
    updated_at = now()
  where id = m.id and owner_id = u returning * into m;
  insert into public.points_transactions
    (owner_id, member_id, sale_amount, points_delta, transaction_type, note, birthday_bonus_year)
  values (u, m.id, sale, total_earned, 'earn',
    coalesce(nullif(memo, ''), 'ให้แต้มจากยอดซื้อ') ||
      case when best_kind = 'birthday' then ' · โปรวันเกิด' else '' end,
    birthday_year);

  if original_level in ('Member', 'Silver') and next_level in ('Gold', 'Platinum') and gold_bonus > 0 then
    bonus_id := null;
    insert into public.points_transactions
      (owner_id, member_id, sale_amount, points_delta, transaction_type, note, rank_bonus_level)
    values (u, m.id, 0, gold_bonus, 'adjustment', 'โบนัสเลื่อนระดับ Gold', 'Gold')
    on conflict do nothing returning id into bonus_id;
    if bonus_id is not null then
      update public.members set points = points + gold_bonus where id = m.id returning * into m;
    end if;
  end if;
  if original_level <> 'Platinum' and next_level = 'Platinum' and platinum_bonus > 0 then
    bonus_id := null;
    insert into public.points_transactions
      (owner_id, member_id, sale_amount, points_delta, transaction_type, note, rank_bonus_level)
    values (u, m.id, 0, platinum_bonus, 'adjustment', 'โบนัสเลื่อนระดับ Platinum', 'Platinum')
    on conflict do nothing returning id into bonus_id;
    if bonus_id is not null then
      update public.members set points = points + platinum_bonus where id = m.id returning * into m;
    end if;
  end if;

  insert into public.audit_logs(owner_id, actor_id, action, entity_type, entity_id, details)
  values (u, u, 'award_points', 'member', m.id::text,
    jsonb_build_object('sale', sale, 'points', m.points, 'purchase_points', total_earned,
      'promotion', best_kind, 'old_level', original_level, 'new_level', next_level));
  return m;
end;
$$;
