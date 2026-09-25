-- The three content types remain separate; these fields support the shared card UI.
alter table public.rewards add column if not exists category text not null default 'ของรางวัล';
alter table public.coupons add column if not exists category text not null default 'คูปอง';
alter table public.coupons add column if not exists image_url text;
alter table public.news add column if not exists category text not null default 'ข่าวสาร';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-content', 'crm-content', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "crm_content_upload_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'crm-content'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
