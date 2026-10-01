-- A deleted member must not free their registration number for reuse.
create table public.member_registration_counters (
  owner_id uuid primary key references public.store_settings(owner_id) on delete cascade,
  last_number integer not null check (last_number >= 0)
);
alter table public.member_registration_counters enable row level security;
revoke all on public.member_registration_counters from public, anon, authenticated;

insert into public.member_registration_counters (owner_id, last_number)
select owner_id, max(member_number) from public.members group by owner_id
on conflict (owner_id) do update
set last_number = greatest(public.member_registration_counters.last_number, excluded.last_number);

create or replace function public.assign_short_member_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  insert into public.member_registration_counters (owner_id, last_number)
  values (new.owner_id, 1)
  on conflict (owner_id) do update
    set last_number = public.member_registration_counters.last_number + 1
  returning last_number into next_number;
  if next_number > 259974 then
    raise exception 'MEMBER_CODE_LIMIT_REACHED';
  end if;
  new.member_number := next_number;
  new.member_code := 'TM' || chr(65 + ((next_number - 1) / 9999))
    || lpad((((next_number - 1) % 9999) + 1)::text, 4, '0');
  return new;
end;
$$;

revoke all on function public.assign_short_member_code() from public, anon, authenticated;
