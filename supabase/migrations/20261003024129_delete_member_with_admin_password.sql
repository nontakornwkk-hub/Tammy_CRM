-- Called only by the server after the owner has re-entered their account password.
-- Keep deletion of restricted dependants and the member in one transaction.
create or replace function public.delete_crm_member(p_owner_id uuid, p_member_id uuid, p_actor_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.members
  where owner_id = p_owner_id and id = p_member_id for update;
  if not found then return false; end if;

  delete from public.redemptions
  where owner_id = p_owner_id and member_id = p_member_id;
  delete from public.audit_logs
  where owner_id = p_owner_id and entity_type = 'member' and entity_id = p_member_id::text;
  delete from public.members
  where owner_id = p_owner_id and id = p_member_id;
  if not found then return false; end if;

  insert into public.audit_logs(owner_id, actor_id, action, entity_type, details)
  values(p_owner_id, p_actor_id, 'delete_member', 'store',
    pg_catalog.jsonb_build_object('member_id', p_member_id));
  return true;
end;
$$;

revoke all on function public.delete_crm_member(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_crm_member(uuid, uuid, uuid) to service_role;
