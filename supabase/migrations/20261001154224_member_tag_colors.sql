create table public.member_tag_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60 and name = btrim(name)),
  color text not null default 'sky' check (color in ('coral', 'sky', 'mint', 'lavender', 'honey')),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

insert into public.member_tag_definitions (owner_id, name, color)
select distinct owner_id, btrim(tag),
  (array['coral', 'sky', 'mint', 'lavender', 'honey'])[(mod(hashtext(tag)::bigint + 2147483648, 5) + 1)::integer]
from public.members cross join lateral unnest(tags) as tag
where btrim(tag) <> ''
on conflict (owner_id, name) do nothing;

alter table public.member_tag_definitions enable row level security;
create policy member_tags_select on public.member_tag_definitions for select to authenticated
  using ((select auth.uid()) = owner_id or (select public.crm_team_can(owner_id, 'points_read')));
create policy member_tags_insert on public.member_tag_definitions for insert to authenticated
  with check ((select auth.uid()) = owner_id or (select public.crm_team_can(owner_id, 'manager')));
create policy member_tags_update on public.member_tag_definitions for update to authenticated
  using ((select auth.uid()) = owner_id or (select public.crm_team_can(owner_id, 'manager')))
  with check ((select auth.uid()) = owner_id or (select public.crm_team_can(owner_id, 'manager')));
create policy member_tags_delete on public.member_tag_definitions for delete to authenticated
  using ((select auth.uid()) = owner_id or (select public.crm_team_can(owner_id, 'manager')));
revoke all on public.member_tag_definitions from anon;
grant select, insert, update, delete on public.member_tag_definitions to authenticated;

create or replace function private.remove_deleted_member_tag()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.members set tags = array_remove(tags, old.name)
  where owner_id = old.owner_id and old.name = any(tags);
  return old;
end;
$$;
revoke all on function private.remove_deleted_member_tag() from public, anon, authenticated;
create trigger remove_deleted_member_tag after delete on public.member_tag_definitions
  for each row execute function private.remove_deleted_member_tag();
