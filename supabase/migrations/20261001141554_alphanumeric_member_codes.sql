-- The visible code has one letter and four digits after TM. Keep the
-- registration sequence separately so staff can see the member's order.
alter table public.members
  add column if not exists member_number integer,
  add column if not exists previous_member_code text;

update public.members
set member_number = substring(member_code from 3)::integer,
    previous_member_code = member_code
where member_number is null and member_code ~ '^TM[0-9]{5}$';

do $$
begin
  if exists (select 1 from public.members where member_number is null) then
    raise exception 'MEMBER_NUMBER_BACKFILL_FAILED';
  end if;
end;
$$;

alter table public.members alter column member_number set not null;
create unique index if not exists members_number_per_owner
  on public.members (owner_id, member_number);
create unique index if not exists members_previous_code_per_owner
  on public.members (owner_id, previous_member_code)
  where previous_member_code is not null;

update public.members
set member_code = 'TM' || chr(65 + ((member_number - 1) / 9999))
  || lpad((((member_number - 1) % 9999) + 1)::text, 4, '0');

create or replace function public.assign_short_member_code()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_number integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text, 21041));
  select coalesce(max(member_number), 0) + 1 into next_number
  from public.members where owner_id = new.owner_id;
  if next_number > 259974 then
    raise exception 'MEMBER_CODE_LIMIT_REACHED';
  end if;
  new.member_number := next_number;
  new.member_code := 'TM' || chr(65 + ((next_number - 1) / 9999))
    || lpad((((next_number - 1) % 9999) + 1)::text, 4, '0');
  return new;
end;
$$;
