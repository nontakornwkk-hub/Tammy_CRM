alter table public.members
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists gender text;

alter table public.members
  add constraint members_gender_check
  check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say'));

create table public.line_member_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  line_user_id text not null,
  linked_at timestamptz not null default now(),
  unique (owner_id, member_id),
  unique (owner_id, line_user_id)
);

create index line_member_links_member_idx on public.line_member_links(member_id);

alter table public.line_member_links enable row level security;
revoke all on public.line_member_links from anon, authenticated;
grant select on public.line_member_links to authenticated;
create policy line_member_links_owner_read on public.line_member_links
  for select to authenticated using ((select auth.uid()) = owner_id);

create function public.register_line_member(
  line_subject text,
  first text,
  last text,
  member_gender text,
  birthday date,
  mobile text
)
returns public.members
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shop_owner uuid;
  linked_member public.members;
  member_code_value text;
begin
  if line_subject !~ '^U[0-9a-f]{32}$'
    or length(trim(first)) < 1 or length(trim(first)) > 80
    or length(trim(last)) < 1 or length(trim(last)) > 80
    or member_gender not in ('male', 'female', 'other', 'prefer_not_to_say')
    or birthday is null or birthday > current_date or birthday < date '1900-01-01'
    or mobile !~ '^0[0-9]{9}$' then
    raise exception 'INVALID_REGISTRATION';
  end if;

  select owner_id into shop_owner
  from public.public_shop_profiles where slug = 'tammy';
  if shop_owner is null then
    raise exception 'SHOP_NOT_CONFIGURED';
  end if;

  select m.* into linked_member
  from public.line_member_links l
  join public.members m on m.id = l.member_id and m.owner_id = l.owner_id
  where l.owner_id = shop_owner and l.line_user_id = line_subject;
  if found then
    return linked_member;
  end if;

  if exists (select 1 from public.members where owner_id = shop_owner and phone = mobile) then
    raise exception 'PHONE_ALREADY_REGISTERED';
  end if;

  member_code_value := 'TM' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.members
    (owner_id, member_code, name, first_name, last_name, gender, birth_date, phone,
     level, points, spending, status, newsletter_opt_in, notes, tags)
  values
    (shop_owner, member_code_value, trim(first) || ' ' || trim(last), trim(first), trim(last),
     member_gender, birthday, mobile, 'Member', 0, 0, 'active', false, '', array['สมัครผ่าน LINE'])
  returning * into linked_member;

  insert into public.line_member_links(owner_id, member_id, line_user_id)
  values (shop_owner, linked_member.id, line_subject);

  select * into linked_member from public.members where id = linked_member.id;
  return linked_member;
end;
$$;

revoke all on function public.register_line_member(text, text, text, text, date, text)
  from public, anon, authenticated;
grant execute on function public.register_line_member(text, text, text, text, date, text)
  to service_role;
