-- Read-only database usage for the authenticated store owner.
-- This reports PostgreSQL database bytes, not Supabase Storage or plan billing.
create or replace function public.crm_database_usage()
returns table (
  database_bytes bigint,
  points_transactions_bytes bigint,
  points_transactions_count bigint,
  members_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_settings
    where owner_id = (select auth.uid())
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    pg_catalog.pg_database_size(pg_catalog.current_database()),
    pg_catalog.pg_total_relation_size('public.points_transactions'::pg_catalog.regclass),
    (select count(*) from public.points_transactions where owner_id = (select auth.uid())),
    (select count(*) from public.members where owner_id = (select auth.uid()));
end;
$$;

revoke all on function public.crm_database_usage() from public, anon;
grant execute on function public.crm_database_usage() to authenticated;
