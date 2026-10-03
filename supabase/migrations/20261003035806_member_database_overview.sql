-- A regular view stores no duplicate member or LINE records.
-- Keep the underlying tables and public/legacy identity codes intact.
create view public.members_overview with (security_invoker = true) as
select
  row_number() over (partition by m.owner_id order by m.member_number,m.created_at,m.id) as list_order,
  m.member_number,
  m.member_code,
  m.name,
  m.phone,
  m.email,
  m.level,
  m.points,
  m.spending,
  m.status,
  m.dog_count,
  m.cat_count,
  (l.member_id is not null) as line_connected,
  l.line_display_name,
  l.line_user_id,
  l.line_picture_url,
  l.linked_at as line_linked_at,
  l.profile_synced_at as line_profile_synced_at,
  m.first_name,
  m.last_name,
  m.gender,
  m.birth_date,
  m.birth_date_changed_at,
  m.last_visit,
  m.tags,
  m.notes,
  m.newsletter_opt_in,
  m.privacy_consent_updated_at,
  m.privacy_consent_version,
  array(select distinct code
    from unnest(array[m.previous_member_code,m.former_member_code,m.legacy_member_code]) code
    where code is not null and code <> m.member_code order by code) as historical_codes,
  m.created_at,
  m.updated_at,
  m.id,
  m.owner_id
from public.members m
left join public.line_member_links l on l.member_id=m.id and l.owner_id=m.owner_id
order by m.owner_id,m.member_number,m.created_at,m.id;

revoke all on public.members_overview from public,anon,authenticated;
grant select on public.members_overview to authenticated,service_role;
comment on view public.members_overview is 'Read-only member directory with LINE information; zero duplicate row storage; underlying RLS applies.';
comment on column public.members_overview.list_order is 'Contiguous display order; existing member_number and public code remain intact.';
comment on column public.members_overview.historical_codes is 'Previous QR/POS codes combined for display; no duplicate storage.';
notify pgrst, 'reload schema';
