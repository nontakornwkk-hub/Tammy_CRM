-- Active managers may edit store configuration, but only the owner manages
-- team accounts and the owner row itself cannot be reassigned.
create policy team_settings_update on public.store_settings
for update to authenticated
using ((select public.crm_team_can(owner_id, 'manager')))
with check ((select public.crm_team_can(owner_id, 'manager')));

create policy team_shop_profile_update on public.public_shop_profiles
for update to authenticated
using ((select public.crm_team_can(owner_id, 'manager')))
with check ((select public.crm_team_can(owner_id, 'manager')));
