-- Phase 1: add and sync the new storage while the application deploys.
alter table public.members
  add column line_user_id text,
  add column line_display_name text,
  add column line_picture_url text,
  add column line_linked_at timestamptz,
  add column line_profile_synced_at timestamptz;
update public.members m set line_user_id=l.line_user_id,line_display_name=l.line_display_name,
  line_picture_url=l.line_picture_url,line_linked_at=l.linked_at,line_profile_synced_at=l.profile_synced_at
from public.line_member_links l where m.id=l.member_id and m.owner_id=l.owner_id;
create unique index members_line_user_per_owner on public.members(owner_id,line_user_id) where line_user_id is not null;
alter table public.members add constraint members_line_subject_valid check(line_user_id is null or line_user_id ~ '^U[0-9a-f]{32}$');

-- Only backend services can change LINE identity; ordinary CRM edits still work.
create function private.guard_member_line_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    if tg_op='INSERT' then
      if new.line_user_id is not null or new.line_display_name is not null or new.line_picture_url is not null
        or new.line_linked_at is not null or new.line_profile_synced_at is not null then
        raise exception 'LINE_IDENTITY_SERVICE_ONLY';
      end if;
    elsif row(new.line_user_id,new.line_display_name,new.line_picture_url,new.line_linked_at,new.line_profile_synced_at)
      is distinct from row(old.line_user_id,old.line_display_name,old.line_picture_url,old.line_linked_at,old.line_profile_synced_at) then
      raise exception 'LINE_IDENTITY_SERVICE_ONLY';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_member_line_identity() from public,anon,authenticated;
create trigger guard_member_line_identity before insert or update on public.members
for each row execute function private.guard_member_line_identity();

-- Bidirectional syncing exists only during the deployment window.
create function private.sync_member_line_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if pg_trigger_depth()>1 then return null; end if;
  if tg_table_name='line_member_links' then
    if tg_op='DELETE' then
      update public.members set line_user_id=null,line_display_name=null,line_picture_url=null,
        line_linked_at=null,line_profile_synced_at=null where id=old.member_id and owner_id=old.owner_id;
    else
      update public.members set line_user_id=new.line_user_id,line_display_name=new.line_display_name,
        line_picture_url=new.line_picture_url,line_linked_at=new.linked_at,line_profile_synced_at=new.profile_synced_at
      where id=new.member_id and owner_id=new.owner_id;
    end if;
  elsif tg_op='INSERT' or row(new.line_user_id,new.line_display_name,new.line_picture_url,new.line_linked_at,new.line_profile_synced_at)
    is distinct from row(old.line_user_id,old.line_display_name,old.line_picture_url,old.line_linked_at,old.line_profile_synced_at) then
    if new.line_user_id is null then
      if tg_op='UPDATE' and old.line_user_id is not null then
        delete from public.line_member_links where member_id=new.id and owner_id=new.owner_id;
      end if;
    else
      insert into public.line_member_links(owner_id,member_id,line_user_id,line_display_name,line_picture_url,linked_at,profile_synced_at)
      values(new.owner_id,new.id,new.line_user_id,new.line_display_name,new.line_picture_url,coalesce(new.line_linked_at,now()),new.line_profile_synced_at)
      on conflict(owner_id,member_id) do update set line_user_id=excluded.line_user_id,line_display_name=excluded.line_display_name,
        line_picture_url=excluded.line_picture_url,linked_at=excluded.linked_at,profile_synced_at=excluded.profile_synced_at;
    end if;
  end if;
  return null;
end $$;
revoke all on function private.sync_member_line_identity() from public,anon,authenticated;
create trigger sync_member_line_from_old after insert or update or delete on public.line_member_links
for each row execute function private.sync_member_line_identity();
create trigger sync_member_line_to_old after insert or update on public.members
for each row execute function private.sync_member_line_identity();
notify pgrst,'reload schema';
