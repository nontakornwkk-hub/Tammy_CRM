-- Keep the old external identifier for existing POS/QR integrations while showing
-- a short, sequential member number throughout the CRM.
alter table public.members add column if not exists legacy_member_code text;
create unique index if not exists members_legacy_code_per_owner
  on public.members (owner_id, legacy_member_code)
  where legacy_member_code is not null;

do $$
begin
  if exists (
    select 1 from (
      select owner_id, count(*) filter (where member_code !~ '^TM[0-9]{5}$') as old_count,
        coalesce(max(substring(member_code from 3)::integer) filter (where member_code ~ '^TM[0-9]{5}$'), 0) as highest
      from public.members group by owner_id
    ) codes where codes.old_count + codes.highest > 99999
  ) then
    raise exception 'MEMBER_CODE_LIMIT_REACHED';
  end if;
end;
$$;

with base as (
  select owner_id,
    coalesce(max(substring(member_code from 3)::integer) filter (where member_code ~ '^TM[0-9]{5}$'), 0) as highest
  from public.members group by owner_id
), numbered as (
  select m.id, m.owner_id, m.member_code,
    row_number() over (partition by m.owner_id order by m.created_at, m.id) as ordinal
  from public.members m
  where m.member_code !~ '^TM[0-9]{5}$'
)
update public.members m
set legacy_member_code = numbered.member_code,
    member_code = 'TM' || lpad((base.highest + numbered.ordinal)::text, 5, '0')
from numbered join base on base.owner_id = numbered.owner_id
where m.id = numbered.id;

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
  select coalesce(max(substring(member_code from 3)::integer), 0) + 1
    into next_number
  from public.members
  where owner_id = new.owner_id and member_code ~ '^TM[0-9]{5}$';
  if next_number > 99999 then
    raise exception 'MEMBER_CODE_LIMIT_REACHED';
  end if;
  new.member_code := 'TM' || lpad(next_number::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists assign_short_member_code on public.members;
create trigger assign_short_member_code
before insert on public.members
for each row execute function public.assign_short_member_code();
