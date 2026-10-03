-- Phase 2: run only after the application reads/writes members directly.
lock table public.members,public.line_member_links in share row exclusive mode;
do $$ begin
  if exists(select 1 from public.line_member_links l left join public.members m
    on m.id=l.member_id and m.owner_id=l.owner_id
    where m.id is null or row(m.line_user_id,m.line_display_name,m.line_picture_url,m.line_linked_at,m.line_profile_synced_at)
      is distinct from row(l.line_user_id,l.line_display_name,l.line_picture_url,l.linked_at,l.profile_synced_at)) then
    raise exception 'LINE_DATA_NOT_FULLY_MIGRATED';
  end if;
end $$;

create or replace function public.register_line_member(line_subject text,first text,last text,member_gender text,birthday date,mobile text)
returns public.members language plpgsql security invoker set search_path='' as $$
declare shop_owner uuid; linked_member public.members;
begin
  if line_subject is null or first is null or last is null or member_gender is null or mobile is null
    or line_subject !~ '^U[0-9a-f]{32}$' or length(trim(first)) not between 1 and 80 or length(trim(last)) not between 1 and 80
    or member_gender not in ('male','female','other','prefer_not_to_say')
    or birthday is null or birthday>current_date or birthday<date '1900-01-01' or mobile !~ '^0[0-9]{9}$' then
    raise exception 'INVALID_REGISTRATION';
  end if;
  select owner_id into shop_owner from public.public_shop_profiles where slug='tammy';
  if shop_owner is null then raise exception 'SHOP_NOT_CONFIGURED'; end if;
  select * into linked_member from public.members where owner_id=shop_owner and line_user_id=line_subject;
  if found then return linked_member; end if;
  if exists(select 1 from public.members where owner_id=shop_owner and phone=mobile) then raise exception 'PHONE_ALREADY_REGISTERED'; end if;
  insert into public.members(owner_id,member_code,name,first_name,last_name,gender,birth_date,phone,level,points,spending,status,newsletter_opt_in,notes,tags,line_user_id,line_linked_at)
  values(shop_owner,'TM'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),trim(first)||' '||trim(last),trim(first),trim(last),
    member_gender,birthday,mobile,'Member',0,0,'active',false,'',array['สมัครผ่าน LINE'],line_subject,now())
  returning * into linked_member;
  return linked_member;
end $$;
revoke all on function public.register_line_member(text,text,text,text,date,text) from public,anon,authenticated;
grant execute on function public.register_line_member(text,text,text,text,date,text) to service_role;

create or replace function public.complete_line_member_transfer(p_owner_id uuid,p_request_id uuid,p_actor_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare request_row public.line_member_transfer_requests; previous_subject text;
begin
  select * into request_row from public.line_member_transfer_requests where id=p_request_id and owner_id=p_owner_id for update;
  if not found or request_row.status<>'claimed' or request_row.new_line_user_id is null then raise exception 'TRANSFER_NOT_READY'; end if;
  select line_user_id into previous_subject from public.members where id=request_row.member_id and owner_id=p_owner_id and status='active' for update;
  if not found then raise exception 'MEMBER_NOT_ACTIVE'; end if;
  if exists(select 1 from public.members where owner_id=p_owner_id and line_user_id=request_row.new_line_user_id) then raise exception 'LINE_ALREADY_LINKED'; end if;
  update public.members set line_user_id=request_row.new_line_user_id,line_display_name=request_row.new_line_display_name,
    line_picture_url=request_row.new_line_picture_url,line_profile_synced_at=now(),line_linked_at=now()
  where id=request_row.member_id and owner_id=p_owner_id;
  update public.line_member_transfer_requests set status='completed',old_line_user_id=previous_subject,completed_by=p_actor_id,completed_at=now()
  where id=p_request_id and owner_id=p_owner_id;
end $$;
revoke all on function public.complete_line_member_transfer(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_line_member_transfer(uuid,uuid,uuid) to service_role;

create or replace function public.delete_line_member_account(p_owner_id uuid,p_member_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.members where owner_id=p_owner_id and id=p_member_id and line_user_id is not null) then return false; end if;
  delete from public.redemptions where owner_id=p_owner_id and member_id=p_member_id;
  delete from public.audit_logs where owner_id=p_owner_id and entity_type='member' and entity_id=p_member_id::text;
  delete from public.members where owner_id=p_owner_id and id=p_member_id;
  return found;
end $$;
revoke all on function public.delete_line_member_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_line_member_account(uuid,uuid) to service_role;

drop trigger sync_member_line_to_old on public.members;
drop trigger sync_member_line_from_old on public.line_member_links;
drop function private.sync_member_line_identity();
drop view public.members_overview;
drop table public.line_member_links;

-- Preserve the previous service-only visibility of LINE data after consolidation.
revoke select on public.members from public,anon,authenticated;
do $$ declare columns text; begin
  select string_agg(quote_ident(column_name),',') into columns from information_schema.columns
  where table_schema='public' and table_name='members' and column_name not in
    ('line_user_id','line_display_name','line_picture_url','line_linked_at','line_profile_synced_at');
  execute 'grant select ('||columns||') on public.members to authenticated';
end $$;
comment on column public.members.line_user_id is 'LINE identity stored once with member; unique per shop; service-only access.';
notify pgrst,'reload schema';
