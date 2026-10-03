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
