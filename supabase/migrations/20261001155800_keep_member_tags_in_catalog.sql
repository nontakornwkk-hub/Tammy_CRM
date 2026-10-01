-- Tags removed from the shared catalog must not return on later member signups.
create or replace function private.keep_member_tags_in_catalog()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.tags := array(
    select distinct tag from unnest(coalesce(new.tags, '{}'::text[])) as entry(tag)
    where exists (
      select 1 from public.member_tag_definitions definition
      where definition.owner_id = new.owner_id and definition.name = entry.tag
    )
  );
  return new;
end;
$$;
revoke all on function private.keep_member_tags_in_catalog() from public, anon, authenticated;
create trigger keep_member_tags_in_catalog before insert or update of tags on public.members
  for each row execute function private.keep_member_tags_in_catalog();
