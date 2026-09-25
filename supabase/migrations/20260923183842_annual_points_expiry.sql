-- An opt-in year-end expiry, with one auditable run per store and year.
create extension if not exists pg_cron with schema pg_catalog;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.point_expiry_runs (
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  closing_year integer not null,
  members_affected integer not null default 0,
  points_expired integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (owner_id, closing_year)
);
alter table public.point_expiry_runs enable row level security;
revoke all on public.point_expiry_runs from anon, authenticated;
grant select on public.point_expiry_runs to authenticated;
create policy "point_expiry_runs_select_own" on public.point_expiry_runs
for select to authenticated using ((select auth.uid()) = owner_id);

create function private.expire_year_end_points()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  local_day date := (now() at time zone 'Asia/Bangkok')::date;
  closing_year_value integer := extract(year from (now() at time zone 'Asia/Bangkok'))::integer - 1;
  shop record;
  member record;
  claimed_owner uuid;
  affected integer;
  expired integer;
begin
  -- The scheduler fires at 00:05 Bangkok time on January 1.
  if extract(month from local_day) <> 1 or extract(day from local_day) <> 1 then
    return;
  end if;

  for shop in
    select owner_id from public.store_settings
    where extra ->> 'points_expiration' = 'รีทุกสิ้นปี'
  loop
    claimed_owner := null;
    affected := 0;
    expired := 0;
    insert into public.point_expiry_runs(owner_id, closing_year)
    values (shop.owner_id, closing_year_value)
    on conflict do nothing
    returning owner_id into claimed_owner;
    if claimed_owner is null then continue; end if;

    for member in
      select id, points from public.members
      where owner_id = shop.owner_id and points > 0
      for update
    loop
      update public.members set points = 0, updated_at = now()
      where id = member.id;
      insert into public.points_transactions
        (owner_id, member_id, sale_amount, points_delta, transaction_type, note)
      values
        (shop.owner_id, member.id, 0, -member.points, 'adjustment',
         'รีเซ็ตแต้มสิ้นปี ' || closing_year_value::text);
      affected := affected + 1;
      expired := expired + member.points;
    end loop;

    update public.point_expiry_runs
    set members_affected = affected, points_expired = expired
    where owner_id = shop.owner_id and closing_year = closing_year_value;
    insert into public.audit_logs
      (owner_id, actor_id, action, entity_type, details)
    values
      (shop.owner_id, shop.owner_id, 'expire_year_end_points', 'store',
       pg_catalog.jsonb_build_object('closing_year', closing_year_value, 'members_affected', affected, 'points_expired', expired));
  end loop;
end;
$$;
revoke all on function private.expire_year_end_points() from public, anon, authenticated;

select cron.schedule(
  'tammy-year-end-points',
  '5 17 31 12 *',
  'select private.expire_year_end_points();'
);
