-- Keep member_number private to staff while giving customers an opaque short code.
alter table public.members add column if not exists former_member_code text;
create unique index if not exists members_former_code_per_owner
  on public.members (owner_id, former_member_code)
  where former_member_code is not null;

create or replace function private.random_member_code(target_owner uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  candidate text;
  i integer;
  attempt integer;
begin
  for attempt in 1..100 loop
    bytes := extensions.gen_random_bytes(5);
    candidate := 'TM';
    for i in 0..4 loop
      candidate := candidate || substr(alphabet, pg_catalog.get_byte(bytes, i) % length(alphabet) + 1, 1);
    end loop;
    if candidate !~ '[A-Z]' or candidate !~ '[2-9]' then continue; end if;
    if not exists (
      select 1 from public.members
      where owner_id = target_owner
        and candidate in (member_code, previous_member_code, legacy_member_code, former_member_code)
    ) then return candidate; end if;
  end loop;
  raise exception 'MEMBER_CODE_GENERATION_FAILED';
end;
$$;
revoke all on function private.random_member_code(uuid) from public, anon, authenticated;

do $$
declare
  member record;
begin
  for member in select id, owner_id, member_code from public.members order by owner_id, member_number loop
    update public.members
    set former_member_code = member.member_code,
        member_code = private.random_member_code(member.owner_id)
    where id = member.id;
  end loop;
end;
$$;

create or replace function public.assign_short_member_code()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  next_number integer;
begin
  insert into public.member_registration_counters (owner_id, last_number)
  values (new.owner_id, 1)
  on conflict (owner_id) do update
    set last_number = public.member_registration_counters.last_number + 1
  returning last_number into next_number;
  new.member_number := next_number;
  new.member_code := private.random_member_code(new.owner_id);
  return new;
end;
$$;
revoke all on function public.assign_short_member_code() from public, anon, authenticated;

alter table public.members add constraint members_random_code_shape
  check (member_code ~ '^TM[A-HJ-NP-Z2-9]{5}$'
    and substring(member_code from 3) ~ '[A-Z]'
    and substring(member_code from 3) ~ '[2-9]');
