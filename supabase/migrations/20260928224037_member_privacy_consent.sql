alter table public.members
  add column if not exists privacy_consent_updated_at timestamptz,
  add column if not exists privacy_consent_version text;
