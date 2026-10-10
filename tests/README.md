# Transaction checks

These tests run against an isolated in-memory PostgreSQL database. They never connect to Supabase or change shop data.

Install the test-only runtime outside the app dependency tree:

```powershell
npm install --prefix .tmp/transaction-verification --no-save --package-lock=false @electric-sql/pglite@0.5.8
node tests/transaction-reversals.mjs
node --experimental-strip-types tests/transaction-history.mjs
```

Use Node.js 22.6 or newer for the TypeScript domain checks. The SQL fixture models only columns used by these migrations; a staging integration check is still needed before enabling changes in Supabase.

Connection cache and sidebar preference checks (uses the project's TypeScript dependency):

    node tests/connections-and-sidebar.mjs

History scrolling and detail prefetch checks:

    node --experimental-strip-types tests/history-scroll-and-cache.mjs

This verifies Bangkok month boundaries, cursor pagination across more than 1,000 mixed transactions (including equal timestamps), account isolation and request deduplication. The UI opens a row immediately from list data while authoritative details are revalidated. Management commands stay disabled until this check finishes.

Member latency checks:

    node tests/member-speed.mjs

The latency check uses delayed mock responses to verify bootstrap deduplication, warm navigation, QR expiry and logout races. Its millisecond results measure local cache/encoding, not LINE login or real Supabase network latency. The catalog check uses two isolated PostgreSQL databases and rejects every production-side write.

Customer login transitions and current-member ordinal/history checks:

    node tests/customer-login-entry.mjs
    node tests/customer-route-separation.mjs
    node tests/member-order-and-redemptions.mjs

The history check uses the same test-only PGlite runtime described above. It verifies saved item titles after deleting rewards/coupons, scoped history pagination, and contiguous display order after member deletion/new signup. See `docs/customer-login-performance.md` for the scope of the real read-only latency measurements.
