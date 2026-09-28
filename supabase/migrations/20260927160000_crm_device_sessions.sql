-- Only expose and revoke sessions owned by the signed-in account.
create or replace function public.crm_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_seen_at timestamptz,
  user_agent text,
  ip text,
  is_current boolean
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.created_at,
    coalesce(s.refreshed_at at time zone 'UTC', s.updated_at),
    s.user_agent, s.ip::text,
    s.id::text = (select auth.jwt()->>'session_id')
  from auth.sessions s
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at at time zone 'UTC', s.updated_at) desc;
$$;

create or replace function public.crm_revoke_my_session(target_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_session_id text := (select auth.jwt()->>'session_id');
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;
  if target_id is null or target_id::text = current_session_id then
    raise exception 'Cannot revoke the current session with this action';
  end if;

  delete from auth.sessions s
  where s.id = target_id and s.user_id = actor_id;
  return found;
end;
$$;

revoke all on function public.crm_my_sessions() from public, anon;
revoke all on function public.crm_revoke_my_session(uuid) from public, anon;
grant execute on function public.crm_my_sessions() to authenticated;
grant execute on function public.crm_revoke_my_session(uuid) to authenticated;
