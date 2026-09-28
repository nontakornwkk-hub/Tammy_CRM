-- New accounts are now added by the store owner through team_accounts RLS.
-- Keep existing team rows, roles and invitations intact.
drop function if exists public.crm_request_team_access(text);
