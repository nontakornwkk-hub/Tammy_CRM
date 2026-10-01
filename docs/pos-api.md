# POS API v1

This API connects a separate POS application to Tammy CRM. It runs on the CRM server. Keep the API key on the POS server or a trusted device backend; never put it in browser or mobile app source code.

The CRM owner can copy the URL, key, endpoints and sample request in one action from **LINE → POS API**. The key is fetched only when the owner presses the copy button.

## Setup

1. Apply the POS migrations `20260929223629_pos_api_sales.sql` and `20260929224500_pos_sale_zero_points_and_member_delete.sql` to any new CRM database. Both have already been applied to the connected Tammy_CRM project.
2. Add `POS_API_KEY` to the CRM server environment. Generate a random value of at least 32 characters, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Set `POS_SHOP_SLUG` if the shop profile slug is not `tammy`. Set `POS_PUBLIC_BASE_URL` to the public HTTPS CRM domain if it differs from the deployment URL. The CRM's existing `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` must also be configured.
4. Restart the CRM server. Call endpoints over HTTPS in production.

Send `Authorization: Bearer <POS_API_KEY>` on every request. All responses use JSON and `Cache-Control: no-store`. Keys are scoped to the shop profile selected by the CRM server; callers cannot supply an owner ID.

## Look up a member

`GET /api/pos/v1/members?memberCode=TM0001` or `GET /api/pos/v1/members?phone=0812345678`.

Provide exactly one search parameter. Both are exact matches. Example response:

```json
{
  "member": {
    "id": "06bf37f8-929b-4dd0-b6e6-bb7d5a7cb60e",
    "memberCode": "TM0001",
    "name": "Customer Name",
    "phone": "0812345678",
    "level": "Gold",
    "points": 240,
    "totalSpending": 5300,
    "status": "active"
  }
}
```

## Record a sale and award points

`POST /api/pos/v1/sales` with `Content-Type: application/json`:

```json
{
  "externalSaleId": "POS-20260930-0001",
  "memberCode": "TM0001",
  "saleAmount": "259.50",
  "note": "Counter 1"
}
```

`saleAmount` is a decimal **string** in baht with at most two decimal places. `externalSaleId` is the stable, unique receipt or transaction ID from the POS (letters, numbers, `.`, `_`, `:`, `-`; maximum 120 characters). `note` is optional and limited to 200 characters.

The CRM calculates points, promotions, birthday bonus and rank using its current store settings. A new sale returns HTTP `201` and a `sale` object with `saleId`, `externalSaleId`, `memberId`, `saleAmount`, `pointsAwarded`, `pointsBalance`, `level`, `totalSpending`, `createdAt`, and `replayed: false`.

Retry the **same** request after a timeout using the same `externalSaleId`. The CRM returns HTTP `200`, the original result and `replayed: true`, without awarding points again. Reusing an ID with different member, amount or note returns HTTP `409` with `SALE_ID_REUSED`. POS systems should keep the sale ID until they receive a definite response. Small purchases can earn 0 points while still increasing total spending. This endpoint records the sale for CRM loyalty accounting; it does not process payment or manage POS inventory. Avoid putting personal information in `note`; historic sale records remain after a member account is deleted, with the member ID cleared.

Example request:

```bash
curl -X POST "https://your-crm.example.com/api/pos/v1/sales" \
  -H "Authorization: Bearer $POS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"externalSaleId":"POS-20260930-0001","memberCode":"TM0001","saleAmount":"259.50"}'
```

## Errors

Errors have `{ "error": "...", "code": "..." }`. Important codes: `UNAUTHORIZED` (`401`), `INVALID_LOOKUP` or `INVALID_SALE` (`400`), `MEMBER_NOT_FOUND` (`404`), `SALE_ID_REUSED` or `POINTS_DISABLED` (`409`), `POS_NOT_CONFIGURED` or `POS_NOT_READY` (`503`). A `502` means the CRM could not complete a database operation; retry the same sale ID after resolving the outage.
