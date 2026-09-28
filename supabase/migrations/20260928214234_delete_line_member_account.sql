-- Called only by the server after verifying the LINE ID token and member link.
-- Keep the dependent deletes in one database transaction.
create or replace function public.delete_line_member_account(p_owner_id uuid, p_member_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  subject text;
begin
  select l.line_user_id into subject
  from public.line_member_links l
  where l.owner_id = p_owner_id and l.member_id = p_member_id;
  if subject is null then
    return false;
  end if;

  delete from public.line_conversations
  where owner_id = p_owner_id and line_user_id = subject;
  delete from public.redemptions
  where owner_id = p_owner_id and member_id = p_member_id;
  delete from public.audit_logs
  where owner_id = p_owner_id and entity_type = 'member' and entity_id = p_member_id::text;
  delete from public.members
  where owner_id = p_owner_id and id = p_member_id;

  return found;
end;
$$;

revoke all on function public.delete_line_member_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_line_member_account(uuid, uuid) to service_role;
