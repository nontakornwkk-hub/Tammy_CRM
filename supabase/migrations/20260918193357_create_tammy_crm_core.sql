create extension if not exists pgcrypto;

create table public.members (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_code text not null, name text not null, phone text, email text,
  level text not null default 'Member' check (level in ('Gold', 'Silver', 'Member')),
  points integer not null default 0 check (points >= 0), spending numeric(12,2) not null default 0 check (spending >= 0),
  last_visit date, status text not null default 'active' check (status in ('active', 'inactive')),
  newsletter_opt_in boolean not null default false, notes text not null default '', tags text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (owner_id, member_code), unique (owner_id, phone)
);
create table public.pets (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade, name text not null,
  species text not null check (species in ('cat', 'dog', 'other')), breed text,
  sex text check (sex in ('male', 'female', 'unknown')), birth_date date, allergies text[] not null default '{}',
  health_note text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.points_transactions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade, sale_amount numeric(12,2) not null default 0 check (sale_amount >= 0),
  points_delta integer not null, transaction_type text not null default 'earn' check (transaction_type in ('earn', 'redeem', 'adjustment')),
  note text not null default '', created_at timestamptz not null default now()
);
create index members_owner_name_idx on public.members (owner_id, name);
create index members_owner_last_visit_idx on public.members (owner_id, last_visit desc);
create index pets_owner_member_idx on public.pets (owner_id, member_id);
create index pets_member_id_idx on public.pets (member_id);
create index points_transactions_owner_member_created_idx on public.points_transactions (owner_id, member_id, created_at desc);
create index points_transactions_member_id_idx on public.points_transactions (member_id);

alter table public.members enable row level security;
alter table public.pets enable row level security;
alter table public.points_transactions enable row level security;
create policy "members_select_own" on public.members for select to authenticated using ((select auth.uid()) = owner_id);
create policy "members_insert_own" on public.members for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "members_update_own" on public.members for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "members_delete_own" on public.members for delete to authenticated using ((select auth.uid()) = owner_id);
create policy "pets_select_own" on public.pets for select to authenticated using ((select auth.uid()) = owner_id);
create policy "pets_insert_own" on public.pets for insert to authenticated with check ((select auth.uid()) = owner_id and exists (select 1 from public.members m where m.id = member_id and m.owner_id = (select auth.uid())));
create policy "pets_update_own" on public.pets for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id and exists (select 1 from public.members m where m.id = member_id and m.owner_id = (select auth.uid())));
create policy "pets_delete_own" on public.pets for delete to authenticated using ((select auth.uid()) = owner_id);
create policy "points_select_own" on public.points_transactions for select to authenticated using ((select auth.uid()) = owner_id);
create policy "points_insert_own" on public.points_transactions for insert to authenticated with check ((select auth.uid()) = owner_id and exists (select 1 from public.members m where m.id = member_id and m.owner_id = (select auth.uid())));
create policy "points_update_own" on public.points_transactions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "points_delete_own" on public.points_transactions for delete to authenticated using ((select auth.uid()) = owner_id);
revoke all on table public.members, public.pets, public.points_transactions from anon;
grant select, insert, update, delete on table public.members, public.pets, public.points_transactions to authenticated;
