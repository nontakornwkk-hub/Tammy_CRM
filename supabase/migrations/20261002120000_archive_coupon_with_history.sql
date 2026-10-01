-- A redeemed coupon remains referenced by redemptions for purchase history.
-- Archiving removes it from active catalogs without deleting that reference.
alter table public.coupons add column if not exists archived_at timestamptz;
