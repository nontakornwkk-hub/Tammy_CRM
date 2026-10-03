# Member data in Supabase — consolidated storage

Open `public.members` in Supabase. Member and LINE data are physically stored in the same row. The former `line_member_links` table and temporary `members_overview` view are removed after the application deployment has been verified.

LINE columns are `line_user_id`, `line_display_name`, `line_picture_url`, `line_linked_at`, and `line_profile_synced_at`. A partial unique index enforces one LINE subject per shop. UUIDs, public codes, member numbers, balances, and existing history are preserved.

- Sort `member_number` ascending for the original member sequence.
- Old member-code columns continue to support previously printed QR/POS codes. They are not extra member records.
- Use the existing LINE registration/transfer flows to change account links.

## Deployment and verification

1. Create encrypted, Git-ignored backups using `scripts/backup-member-line-data.mjs test` and `production`. The script verifies decryption and ownership consistency. Backup data and the local decryption key are under `artifacts/private-member-backups`; never commit them.
2. Apply phase 1, `merge_line_identity_into_members`: copy existing values, add uniqueness and backend-only identity mutation guard, temporarily sync both storage locations for compatibility during deployment.
3. Test phase 2 on the isolated test database: registration, repeat registration, transfer, deletion, ownership, protected column access and record counts.
4. Deploy the application using direct member queries. Browser queries explicitly select ordinary member fields; LINE reads remain in authenticated backend routes.
5. Apply phase 2, `remove_merged_line_member_links`: verify every old link matches the copied values, rewrite registration/transfer/deletion functions, remove temporary sync triggers, overview and original link table. Do not use CASCADE. Failure rolls back the migration transaction.
6. Verify the three original production LINE links map to the same member UUIDs and compare membership balances/identities to the encrypted snapshot.

## Access and rollback

Underlying member RLS remains enabled. Authenticated browser users receive SELECT grants for ordinary member columns, not LINE columns. Only service-side routes can change LINE identity. The three revised RPCs are SECURITY INVOKER and service-role-only.

Before phase 2, rollback can restore the previous application while both storage locations remain synchronized. After phase 2, stop affected writes before rollback, rebuild the old link schema/functions from the backed-up migration sources, restore encrypted link rows with their original UUIDs, reconcile LINE changes made since the snapshot, and redeploy the previous application. Do not blindly restore the whole members snapshot over more recent points or purchases. Keep the encrypted backup and local key until rollback is no longer needed.

Removing the original table reclaims its heap and four indexes; the new unique member LINE index uses some space. Report measured net storage rather than claiming that reducing table count alone saves a particular amount.
