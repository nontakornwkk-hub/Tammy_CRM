-- Keep LINE login, member links, points replies, and connection settings.
-- Remove only the CRM inbox and its saved messages/templates.
create or replace function public.delete_line_member_account(p_owner_id uuid, p_member_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  subject text;
begin
  select l.line_user_id into subject from public.line_member_links l
  where l.owner_id = p_owner_id and l.member_id = p_member_id;
  if subject is null then return false; end if;

  delete from public.redemptions where owner_id = p_owner_id and member_id = p_member_id;
  delete from public.audit_logs where owner_id = p_owner_id and entity_type = 'member' and entity_id = p_member_id::text;
  delete from public.members where owner_id = p_owner_id and id = p_member_id;
  return found;
end;
$$;

drop function public.line_record_inbound(uuid,text,text,text,text,text,text);
drop table public.line_messages;
drop table public.line_conversations;
drop table public.line_quick_replies;
