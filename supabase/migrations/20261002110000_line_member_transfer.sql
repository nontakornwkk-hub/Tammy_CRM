create table public.line_member_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'claimed', 'completed', 'cancelled')),
  old_line_user_id text,
  new_line_user_id text,
  new_line_display_name text,
  new_line_picture_url text,
  created_by uuid not null references auth.users(id),
  completed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

create unique index line_member_transfer_one_open_per_member
  on public.line_member_transfer_requests(owner_id, member_id)
  where status in ('waiting', 'claimed');
create index line_member_transfer_claim_lookup
  on public.line_member_transfer_requests(id, status);

alter table public.line_member_transfer_requests enable row level security;
revoke all on public.line_member_transfer_requests from anon, authenticated;

create function public.complete_line_member_transfer(
  p_owner_id uuid, p_request_id uuid, p_actor_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  request_row public.line_member_transfer_requests;
  existing_link public.line_member_links;
begin
  select * into request_row from public.line_member_transfer_requests
  where id = p_request_id and owner_id = p_owner_id for update;
  if not found or request_row.status <> 'claimed' or request_row.new_line_user_id is null then
    raise exception 'TRANSFER_NOT_READY';
  end if;
  if not exists (select 1 from public.members
    where id = request_row.member_id and owner_id = p_owner_id and status = 'active') then
    raise exception 'MEMBER_NOT_ACTIVE';
  end if;
  if exists (select 1 from public.line_member_links
    where owner_id = p_owner_id and line_user_id = request_row.new_line_user_id) then
    raise exception 'LINE_ALREADY_LINKED';
  end if;
  select * into existing_link from public.line_member_links
  where owner_id = p_owner_id and member_id = request_row.member_id for update;
  if found then
    update public.line_member_links set
      line_user_id = request_row.new_line_user_id,
      line_display_name = request_row.new_line_display_name,
      line_picture_url = request_row.new_line_picture_url,
      profile_synced_at = now(), linked_at = now()
    where id = existing_link.id;
  else
    insert into public.line_member_links
      (owner_id, member_id, line_user_id, line_display_name, line_picture_url, profile_synced_at)
    values
      (p_owner_id, request_row.member_id, request_row.new_line_user_id,
       request_row.new_line_display_name, request_row.new_line_picture_url, now());
  end if;
  update public.line_member_transfer_requests set
    status = 'completed', old_line_user_id = existing_link.line_user_id,
    completed_by = p_actor_id, completed_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.complete_line_member_transfer(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_line_member_transfer(uuid, uuid, uuid) to service_role;
