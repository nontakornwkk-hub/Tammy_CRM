-- Read-only project file totals. Supabase bills Storage from an organization-wide
-- time average, so this live object sum is intentionally not called billed usage.
create function public.crm_storage_usage()
returns table (storage_bytes bigint, storage_objects bigint, unknown_size_objects bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.store_settings s where s.owner_id = (select auth.uid())
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    coalesce(sum(case when (o.metadata->>'size') ~ '^[0-9]+$'
      then (o.metadata->>'size')::bigint else 0 end), 0)::bigint,
    count(*)::bigint,
    count(*) filter (where ((o.metadata->>'size') ~ '^[0-9]+$') is not true)::bigint
  from storage.objects o;
end;
$$;

revoke all on function public.crm_storage_usage() from public, anon;
grant execute on function public.crm_storage_usage() to authenticated;
