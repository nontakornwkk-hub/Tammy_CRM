-- Store-scoped invitations. A confirmed Auth email claims an invitation on first login.
create table public.team_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.store_settings(owner_id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique check (email = lower(email)),
  name text not null check (length(btrim(name)) between 1 and 120),
  role text not null check (role in ('manager', 'staff')),
  active boolean not null default true,
  source text not null default 'invite' check (source in ('invite', 'request')),
  approved_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index team_accounts_owner_idx on public.team_accounts(owner_id);
create index team_accounts_pending_idx on public.team_accounts(owner_id, created_at) where source = 'request' and approved_at is null;
alter table public.team_accounts enable row level security;
create policy team_accounts_owner_select on public.team_accounts for select to authenticated
using (owner_id = (select auth.uid()));
create policy team_accounts_owner_insert on public.team_accounts for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.store_settings s where s.owner_id = (select auth.uid())
));
create policy team_accounts_owner_update on public.team_accounts for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy team_accounts_owner_delete on public.team_accounts for delete to authenticated
using (owner_id = (select auth.uid()));
revoke all on public.team_accounts from anon;
grant select, insert, update, delete on public.team_accounts to authenticated;

-- A confirmed, uninvited Auth user may request access to this store only.
-- The row starts disabled and cannot grant any capability before owner approval.
create function public.crm_request_team_access(display_name text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  verified_email text;
  store_owner uuid;
  current_request public.team_accounts%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select lower(u.email) into verified_email from auth.users u
  where u.id = actor and u.email_confirmed_at is not null;
  if verified_email is null then raise exception 'Verified email required'; end if;
  if exists (select 1 from public.store_settings s where s.owner_id = actor) then return 'owner'; end if;
  select p.owner_id into store_owner from public.public_shop_profiles p where p.slug = 'tammy';
  if store_owner is null then raise exception 'Store unavailable'; end if;
  select * into current_request from public.team_accounts t where t.email = verified_email;
  if found then
    if current_request.owner_id <> store_owner then raise exception 'Account already belongs to another store'; end if;
    if current_request.active then return 'active'; end if;
    return 'pending';
  end if;
  insert into public.team_accounts(owner_id, user_id, email, name, role, active, source, approved_at)
  values (store_owner, actor, verified_email,
    left(coalesce(nullif(btrim(display_name), ''), split_part(verified_email, '@', 1)), 120),
    'staff', false, 'request', null);
  return 'requested';
end;
$$;
revoke all on function public.crm_request_team_access(text) from public, anon;
grant execute on function public.crm_request_team_access(text) to authenticated;

-- No user-supplied role claims: the database checks the confirmed Auth identity.
create function public.crm_team_can(target_owner uuid, capability text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    target_owner = (select auth.uid()) or exists (
      select 1 from public.team_accounts t
      join auth.users u on u.id = t.user_id
      where t.owner_id = target_owner and t.user_id = (select auth.uid())
        and t.active and u.email_confirmed_at is not null
        and lower(u.email) = t.email
        and (t.role = 'manager' or capability = 'points_read' and t.role = 'staff')
    )
  );
$$;
revoke all on function public.crm_team_can(uuid,text) from public, anon;
grant execute on function public.crm_team_can(uuid,text) to authenticated;

create function public.crm_current_access()
returns table(owner_id uuid, role text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  verified_email text;
begin
  if actor is null then return; end if;
  select lower(u.email) into verified_email from auth.users u
  where u.id = actor and u.email_confirmed_at is not null;
  if verified_email is null then return; end if;
  if exists (select 1 from public.store_settings s where s.owner_id = actor) then
    return query select actor, 'owner'::text;
    return;
  end if;
  update public.team_accounts t set user_id = actor, updated_at = now()
    where t.email = verified_email and t.active and t.user_id is null;
  return query select t.owner_id, t.role from public.team_accounts t
    where t.user_id = actor and t.email = verified_email and t.active limit 1;
end;
$$;
revoke all on function public.crm_current_access() from public, anon;
grant execute on function public.crm_current_access() to authenticated;

create function public.crm_actor_owner()
returns uuid language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select s.owner_id from public.store_settings s where s.owner_id = (select auth.uid())),
    (select t.owner_id from public.team_accounts t
     join auth.users u on u.id = t.user_id
     where t.user_id = (select auth.uid()) and t.active
       and u.email_confirmed_at is not null and lower(u.email) = t.email)
  );
$$;
revoke all on function public.crm_actor_owner() from public, anon;
grant execute on function public.crm_actor_owner() to authenticated;

-- Staff can see the minimum tables needed to award points. Managers can also
-- maintain members and catalog items. Settings writes remain owner-only.
create policy team_members_read on public.members for select to authenticated
using ((select public.crm_team_can(owner_id, 'points_read')));
create policy team_members_insert on public.members for insert to authenticated
with check ((select public.crm_team_can(owner_id, 'manager')));
create policy team_members_update on public.members for update to authenticated
using ((select public.crm_team_can(owner_id, 'manager')))
with check ((select public.crm_team_can(owner_id, 'manager')));
create policy team_members_delete on public.members for delete to authenticated
using ((select public.crm_team_can(owner_id, 'manager')));
create policy team_points_read on public.points_transactions for select to authenticated
using ((select public.crm_team_can(owner_id, 'points_read')));
create policy team_settings_read on public.store_settings for select to authenticated
using ((select public.crm_team_can(owner_id, 'points_read')));

do $$
declare tab text;
begin
  foreach tab in array array['pets','rewards','coupons','news','redemptions'] loop
    execute format('create policy team_%I_read on public.%I for select to authenticated using ((select public.crm_team_can(owner_id, ''manager'')))', tab, tab);
    execute format('create policy team_%I_insert on public.%I for insert to authenticated with check ((select public.crm_team_can(owner_id, ''manager'')))', tab, tab);
    execute format('create policy team_%I_update on public.%I for update to authenticated using ((select public.crm_team_can(owner_id, ''manager''))) with check ((select public.crm_team_can(owner_id, ''manager'')))', tab, tab);
    execute format('create policy team_%I_delete on public.%I for delete to authenticated using ((select public.crm_team_can(owner_id, ''manager'')))', tab, tab);
  end loop;
end $$;

create policy team_content_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'crm-content' and
  (storage.foldername(name))[1] = (select public.crm_actor_owner())::text and
  (select public.crm_team_can(public.crm_actor_owner(), 'manager'))
);

-- Preserve the existing point calculation, but resolve the store owner from
-- the authenticated actor and write that actor to the audit log. Assertions
-- prevent silently modifying an unexpected future version of the function.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.award_points(uuid,numeric,integer,text)'::regprocedure)
    into definition;
  if position('u uuid := (select auth.uid());' in definition) = 0
    or position('values (u, u, ''award_points''' in definition) = 0 then
    raise exception 'Unexpected award_points implementation';
  end if;
  definition := replace(definition,
    'u uuid := (select auth.uid());',
    'u uuid := public.crm_actor_owner(); actor uuid := (select auth.uid());');
  definition := replace(definition,
    'if u is null or sale is null or sale <= 0 then',
    'if u is null or not public.crm_team_can(u, ''points_read'') or sale is null or sale <= 0 then');
  definition := replace(definition,
    'values (u, u, ''award_points''',
    'values (u, actor, ''award_points''');
  definition := replace(definition, 'RETURNS members', 'RETURNS public.members');
  definition := replace(definition, 'LANGUAGE plpgsql', 'LANGUAGE plpgsql SECURITY DEFINER');
  execute definition;
end $$;
revoke all on function public.award_points(uuid,numeric,integer,text) from public, anon;
grant execute on function public.award_points(uuid,numeric,integer,text) to authenticated;
