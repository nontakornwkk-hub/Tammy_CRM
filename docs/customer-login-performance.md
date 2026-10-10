# Customer login verification — 2026-10-11

The login request now returns member identity, catalog and account data together, after fresh LINE verification. Catalog/account queries run in parallel and reuse the verified owner/member context. The portal seeds its in-memory display cache before entering, so opening coupons, rewards or account does not start a second initial data load.

Explicit portal logout clears member display data and immediately shows phone confirmation. Submitting the phone starts the central loading state synchronously. A five-minute session-only form continuation survives LINE OAuth; it is not an authentication credential. The server still verifies LINE identity, active membership and the linked phone.

The registered `/customer-preview` LIFF endpoint is served through a rewrite, preserving its URL and OAuth parameters rather than redirecting before SDK initialization.

## Measured results

- Production Supabase catalog/account reads after identity verification, five real read-only runs: **302, 286, 278, 278, 415 ms**. These exclude LINE OAuth, browser startup, JavaScript loading and the user's mobile network.
- The previous deployed config endpoint took **2.264 seconds** on the observed uncached request. Its response identified the function region as `iad1`; Supabase is in `ap-northeast-2` (Seoul).
- `vercel.json` now places functions in `icn1`, alongside Supabase. Vercel deployment verification is required to confirm the new region is active.
- The production redemption-history query resolves its columns and relationships after applying the existing preservation migration. There were no production history rows at verification time; populated reward/coupon history and deletion preservation are tested in isolated PostgreSQL.
- Existing member order is computed from signup timestamps and the currently existing owner-scoped rows. The three production members therefore display **1, 2, 3**; permanent member IDs and codes remain stable.

**The 1.5-second end-to-end mobile/LINE login target is not yet verified.** Local cache timings and database read timings must not be reported as complete login time. LINE authorization, network speed, cold starts and browser resource loading can affect that result. No fixed artificial loading delay is used.

## Regression checks

```powershell
node tests/customer-login-entry.mjs
node tests/line-login.mjs
node tests/member-speed.mjs
node tests/member-order-and-redemptions.mjs
```

The entry tests drive the real component handlers against controlled SDK/network responses, including effect replay, wrong-phone retry, OAuth continuation and cancellation. They do not authenticate an actual LINE account.
