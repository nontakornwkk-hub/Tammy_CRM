-- Keep a readable redemption snapshot when a reward or coupon is removed.
alter table public.redemptions
  add column if not exists item_kind text,
  add column if not exists item_title text;

update public.redemptions r
set item_kind = 'reward', item_title = coalesce(rw.title, 'รายการที่เก็บในประวัติ')
from public.rewards rw
where r.reward_id = rw.id and r.item_kind is null;

update public.redemptions r
set item_kind = 'coupon', item_title = coalesce(cp.title, 'รายการที่เก็บในประวัติ')
from public.coupons cp
where r.coupon_id = cp.id and r.item_kind is null;

update public.redemptions
set item_kind = case when reward_id is not null then 'reward' else 'coupon' end,
    item_title = coalesce(item_title, 'รายการที่เก็บในประวัติ')
where item_kind is null or item_title is null;

alter table public.redemptions
  alter column item_kind set not null,
  alter column item_title set not null,
  add constraint redemptions_item_kind_check check (item_kind in ('reward', 'coupon'));

create or replace function public.snapshot_redemption_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if num_nonnulls(new.reward_id, new.coupon_id) <> 1 then
      raise exception 'Exactly one redemption item is required';
    end if;
    if new.reward_id is not null then
      new.item_kind := 'reward';
      select title into new.item_title from public.rewards where id = new.reward_id;
    else
      new.item_kind := 'coupon';
      select title into new.item_title from public.coupons where id = new.coupon_id;
    end if;
    new.item_title := coalesce(new.item_title, 'รายการที่เก็บในประวัติ');
  end if;
  return new;
end $$;

create trigger redemptions_snapshot_before_insert
before insert on public.redemptions for each row execute function public.snapshot_redemption_item();

do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid = 'public.redemptions'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) like '%num_nonnulls%'
  loop
    execute format('alter table public.redemptions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.redemptions
  add constraint redemptions_at_most_one_item_check check (num_nonnulls(reward_id, coupon_id) <= 1),
  drop constraint redemptions_reward_id_fkey,
  add constraint redemptions_reward_id_fkey foreign key (reward_id) references public.rewards(id) on delete set null,
  drop constraint redemptions_coupon_id_fkey,
  add constraint redemptions_coupon_id_fkey foreign key (coupon_id) references public.coupons(id) on delete set null;

create or replace function public.preserve_deleted_item_title()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'rewards' then
    update public.redemptions set item_kind = 'reward', item_title = old.title
    where reward_id = old.id;
  else
    update public.redemptions set item_kind = 'coupon', item_title = old.title
    where coupon_id = old.id;
  end if;
  return old;
end $$;

create trigger preserve_reward_title_before_delete
before delete on public.rewards for each row execute function public.preserve_deleted_item_title();
create trigger preserve_coupon_title_before_delete
before delete on public.coupons for each row execute function public.preserve_deleted_item_title();
