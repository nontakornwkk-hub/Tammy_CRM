-- A customer's first birthday correction starts a rolling one-year editing window.
-- Existing birthdays stay editable once because earlier edits were not tracked.
alter table public.members
  add column if not exists birth_date_changed_at timestamptz;

comment on column public.members.birth_date_changed_at is
  'Last date a member changed their birth date through the customer account.';
