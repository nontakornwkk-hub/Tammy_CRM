# Member data in Supabase

Open `public.members_overview` in the Supabase Table Editor to see member and LINE data together.

Columns are arranged by use: order and identity, contacts, membership balances, pet counts, LINE connection, personal details, historical codes, timestamps and internal UUIDs.

- Sort `member_number` ascending for the original member sequence.
- `list_order` shows contiguous row numbers without changing existing member numbers. Explicitly sort by this column when reading through the API.
- `historical_codes` combines `previous_member_code`, `former_member_code` and `legacy_member_code` into one display field. These are earlier QR/POS identities, not additional members.
- LINE details come from the matching shop and member in `line_member_links`.
- The overview is read-only. Edit member values in `members` or through the CRM; use the existing LINE registration/transfer flows to change account links.

This is an ordinary SQL view, not a copied or materialized table. It stores its query definition, not a second copy of member rows or profile images. Existing tables, codes and history are preserved. It does not reclaim existing database storage. Physically moving LINE columns while retaining the original values would duplicate storage; reclaiming storage requires a separate migration and rollback plan.

Production inspection on 3 October 2026: public tables and indexes use about 1.59 MiB. Table count alone is not a reliable measure of storage. Keep operational history and relational tables that serve separate functions.

The view uses `security_invoker`, so reads obey permissions and RLS on both source tables. Anonymous access is revoked. Team users continue to have only their existing access; this view does not grant additional LINE access.
