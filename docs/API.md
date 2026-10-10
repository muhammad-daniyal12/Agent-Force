# Implemented frontend API

This is the implementation handoff for the pasted frontend contract approved by
the owner. `API_CONTRACT.md` is preserved as the earlier design document; its
envelopes, `/api/requests`, `/api/quotes`, and approval-without-deduction design
are not this implementation's business API. Shared frontend types/components
were not edited. Backend DTOs in `src/lib/server/contracts.ts` match the supplied
interfaces; `src/types/index.ts` was absent locally and on `origin/main`.

## Authentication and security

Every business endpoint verifies the Appwrite session and derives its business
scope from the authenticated account ID. This MVP supports one owner per business;
staff sharing/Teams are deferred. Cross-owner IDs return 404. No owner IDs,
permissions, quotation status, totals, or reviewer identities are accepted as
client-managed fields. Business table/row permissions remain empty.

Use relative `/api` URLs with `credentials: "same-origin"`. Session cookies are
HTTP-only, host-only, SameSite=Lax, and Secure on HTTPS. JSON writes need
`Content-Type: application/json` and the exact `APP_ORIGIN` in `Origin`; browsers
send Origin automatically, while curl must include it explicitly. Reads are
private/no-store. Authentication does not use localStorage or browser API keys.

| Method | Endpoint           | Body                  | Success                                                         |
| ------ | ------------------ | --------------------- | --------------------------------------------------------------- |
| POST   | `/api/auth/login`  | `{ email, password }` | `{ data: { user: { id, name, email } } }`, 200 + session cookie |
| GET    | `/api/auth/me`     | None                  | Same user payload, 200                                          |
| POST   | `/api/auth/logout` | None                  | `{ data: { loggedOut: true } }`, 200 + expired cookie           |

The business endpoints below return **bare DTOs/arrays** exactly as in the pasted
brief, without a success envelope. All handled errors return `{ "error": "safe
message" }`, with `X-Request-ID` for troubleshooting. Use the HTTP status for
401 authentication, 403 origin rejection, 404 missing/unauthorized records,
409 duplicate SKU/already reviewed/stale inventory/idempotency conflicts,
400 malformed JSON/query, 413 oversized body, 415 wrong content type,
422 field validation, 429 rate limit, 503 Appwrite/configuration failure,
504 workflow timeout, and 500 unexpected errors. Unsupported methods return JSON
405 with Allow. Unknown API paths return JSON 404.

## Business endpoints

| Method | Endpoint                      | Input                                                  | Bare success response              |
| ------ | ----------------------------- | ------------------------------------------------------ | ---------------------------------- |
| GET    | `/api/dashboard`              | None                                                   | `DashboardStats`, 200              |
| GET    | `/api/agents`                 | None                                                   | `Agent[]`, 200                     |
| GET    | `/api/products?q=`            | Optional q, max 100 chars; name/SKU/category substring | `Product[]`, 200                   |
| POST   | `/api/products`               | `sku, name, category, price, stock, lowStockThreshold` | `Product`, 201                     |
| PATCH  | `/api/products/:id`           | Nonempty subset of editable product fields             | `Product`, 200                     |
| DELETE | `/api/products/:id`           | None                                                   | `{ ok: true }`, 200                |
| POST   | `/api/operations/run`         | `customerName, customerEmail, request`                 | `OperationRun`, 200                |
| GET    | `/api/quotations?status=`     | Optional pending/approved/rejected                     | `Quotation[]`, 200, newest first   |
| GET    | `/api/quotations/:id`         | None                                                   | `Quotation`, 200                   |
| POST   | `/api/quotations/:id/approve` | `{ note?: string }`                                    | `Quotation`, 200                   |
| POST   | `/api/quotations/:id/reject`  | `{ note?: string }`                                    | `Quotation`, 200                   |
| GET    | `/api/activity?limit=20`      | Limit integer 1-100; default 20                        | `ActivityLog[]`, 200, newest first |

Product price uses major currency units with at most two decimals. Stock and
threshold are integers 0-1,000,000; SKU is uppercased and unique per business.
PATCH treats ID/timestamps as read-only despite the frontend's broad Partial
type. Do not include them or owner fields in update bodies. Name/category limits
are 200/100 characters. Request limits are name 120, valid email 254, message 2000;
notes are at most 1000 characters. Body size is limited to 32 KiB.

Support extracts at most 20 items, each quantity 1-1000. Inventory resolves names
or SKUs only from the current owner's catalog and refuses ambiguous matches.
Sales uses stored prices and checked integer minor-unit arithmetic. Demo discount
is 5% for subtotal strictly greater than 500, or 10% strictly greater than 2000.
Demo tax is `TAX_RATE` applied to the discounted subtotal and rounded to cents.
Neither the tax setting nor these discount rules assert legally correct taxation.
The owner must coordinate display currency with the frontend; no conversion occurs.

Quotes are created pending. Approval atomically records the owner decision,
deducts quantities for `inStock: true` items, and writes an activity log. Rejection
stores the note without deducting stock. Both reject an already-decided quote
with 409. An approval with changed/insufficient stock rolls back completely.
Unavailable items remain flagged `inStock: false` and are not deducted, matching
the pasted contract. Deleted quoted products require owner review before approval.

No LLM key is required. Provider outages, invalid tool output, and bounded timeout
use the deterministic pipeline, with `(fallback)` in step titles. Only extraction
uses a model; stock checks and quotation arithmetic are controlled backend tools.
Nonpurchase/unmatched/ambiguous requests produce friendly summaries and may have
fewer than three steps and a null quotation. LLMs cannot approve or mutate inventory.

Optional `Idempotency-Key` (1–128 letters, digits, underscores, or hyphens) on
`/api/operations/run` preserves one committed
run/quote for retries. Use the same body/key after network uncertainty, and a new
key for intentional new work. Changed body with the same key returns 409.
Concurrent duplicate requests may both extract intent, but only one complete
run/quote/audit transaction commits. There is no durable background queue.

Persistent limits: 120 protected calls/minute/owner, 5 new runs/minute/owner,
10 login attempts/minute/email and 100 login attempts/minute/project. Respect
Retry-After on 429. Schedule `npm run prune:rate-limits` periodically to remove
expired internal rate buckets; pruning is not required to reset the minute limit.
Owner table reads support fewer than 10,000 records in this demo; lists are not a
large-scale pagination contract. No external messages, orders, or charges are sent.

## PowerShell curl examples for all endpoints

Run after private configuration, setup, and seed in [APPWRITE_SETUP.md](./APPWRITE_SETUP.md).
Use `curl.exe` on Windows. The payload/cookie files below are temporary, outside
the repository. Credentials are entered locally; do not paste them into chat.

```powershell
$base = 'http://localhost:3000'
$bodyFile = (New-TemporaryFile).FullName
$cookieJar = (New-TemporaryFile).FullName
function Write-Body($value) {
  [IO.File]::WriteAllText($bodyFile, ($value | ConvertTo-Json -Depth 8 -Compress), [Text.UTF8Encoding]::new($false))
}
$email = Read-Host 'Demo owner email'
$password = Read-Host 'Demo owner password' -AsSecureString
$credential = [Management.Automation.PSCredential]::new($email, $password)
Write-Body @{ email = $email; password = $credential.GetNetworkCredential().Password }
curl.exe --fail-with-body -c $cookieJar -H "Origin: $base" --json "@$bodyFile" "$base/api/auth/login"
Write-Body @{}
curl.exe --fail-with-body -b $cookieJar "$base/api/auth/me"

curl.exe --fail-with-body -b $cookieJar "$base/api/dashboard"
curl.exe --fail-with-body -b $cookieJar "$base/api/agents"
curl.exe --fail-with-body -b $cookieJar "$base/api/products?q=wireless"

Write-Body @{ sku = 'QA-KEYBOARD'; name = 'QA Keyboard'; category = 'Keyboards'; price = 39.99; stock = 20; lowStockThreshold = 3 }
$created = curl.exe --fail-with-body -b $cookieJar -H "Origin: $base" --json "@$bodyFile" "$base/api/products" | ConvertFrom-Json
Write-Body @{ stock = 15 }
curl.exe --fail-with-body -X PATCH -b $cookieJar -H "Origin: $base" --json "@$bodyFile" "$base/api/products/$($created.id)"

Write-Body @{ customerName = 'Ali'; customerEmail = 'ali@example.com'; request = 'I need 10 wireless mice and 5 USB-C hubs for my office' }
$run = curl.exe --fail-with-body -b $cookieJar -H "Origin: $base" -H 'Idempotency-Key: demo-wireless-1' --json "@$bodyFile" "$base/api/operations/run" | ConvertFrom-Json
$quoteId = $run.quotation.id
curl.exe --fail-with-body -b $cookieJar "$base/api/quotations?status=pending"
curl.exe --fail-with-body -b $cookieJar "$base/api/quotations/$quoteId"
Write-Body @{ note = 'Approved for the demo' }
curl.exe --fail-with-body -b $cookieJar -H "Origin: $base" --json "@$bodyFile" "$base/api/quotations/$quoteId/approve"

Write-Body @{ customerName = 'Ali'; customerEmail = 'ali@example.com'; request = 'I need 2 wireless mice' }
$secondRun = curl.exe --fail-with-body -b $cookieJar -H "Origin: $base" -H 'Idempotency-Key: demo-wireless-2' --json "@$bodyFile" "$base/api/operations/run" | ConvertFrom-Json
Write-Body @{ note = 'Rejected for the demo' }
curl.exe --fail-with-body -b $cookieJar -H "Origin: $base" --json "@$bodyFile" "$base/api/quotations/$($secondRun.quotation.id)/reject"
curl.exe --fail-with-body -b $cookieJar "$base/api/activity?limit=20"

# Remove only the scratch product created above; preserve seeded inventory.
curl.exe --fail-with-body -X DELETE -b $cookieJar -H "Origin: $base" "$base/api/products/$($created.id)"
curl.exe --fail-with-body -X POST -b $cookieJar -H "Origin: $base" "$base/api/auth/logout"
Remove-Item -LiteralPath $bodyFile, $cookieJar
```

Automated verification: `npm run test:backend` runs the installed TablesDB SDK
against an isolated HTTP fixture and checks all business endpoints, auth,
cross-owner denial, transactions, stock rollback, repeated approval, fallback,
provider tool formats, and timeout behavior. This is not a live Appwrite Cloud
test. Real Cloud setup, seed, and deployed smoke tests require private credentials.


## Backend-v2 pricing change (pending integration verification)

The quotation agent now uses Pakistan-rupee **demo** pricing: discounts are 0% up to PKR 150,000, 5% when subtotal is above PKR 150,000 and at most PKR 500,000, and 10% above PKR 500,000. Discounts, demo tax and totals round to whole rupees. The default `TAX_RATE` is now `0.18` if unset, and remains configurable. This is a demo configuration, **not legal GST advice**. Existing deployed `TAX_RATE` values override the new default, so production environment variables must be reviewed separately.

No endpoint or DTO shape has changed in this pricing-only increment. New account settings, dealer, restock, follow-up, public quote, and bulk import endpoints described in the backend-v2 request **are not yet implemented**. The changed seed script only adds missing SKUs; it deliberately does not overwrite products already seeded at old prices. Review and migrate existing demo catalog prices explicitly before using the PKR example in a live demonstration.

Example expected numbers for a demonstration quotation: 10 Wireless Mouse @ Rs 2,499 + 10 Mechanical Keyboard @ Rs 12,999 + 5 USB-C Hub @ Rs 6,499 gives Rs 187,475 subtotal, Rs 9,374 volume discount, Rs 32,058 demo tax, Rs 210,159 total.

## Business settings (backend-v2)

Settings are owner scoped and stored in the server-only `business_settings` table (one row per owner). Session, Origin validation on writes, rate limits, 32 KiB JSON size limit, and Zod validation use the existing business API infrastructure.

| Method | Endpoint | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/settings` | None | `{ name, city, phone, email }` |
| PUT | `/api/settings` | `{ name, city?, phone?, email? }` | `{ name, city, phone, email }` |

When no settings row exists, GET returns the authenticated account name (or "My Business" when blank) and empty strings for other fields. PUT replaces the business profile; omitted optional fields become empty strings. Name must be 1-120 characters; city up to 80, phone up to 20 with 10-15 numeric digits after removing spaces/leading +, and email must be blank or valid (up to 254). Rows are owned by the authenticated account and receive no client grants. PUT writes an activity audit entry. No client-supplied owner ID is accepted.

Authenticated PowerShell example using the previously documented `$base`, `$cookieJar`, and `Write-Body` helper:

```powershell
curl.exe --fail-with-body -b $cookieJar "$base/api/settings"
Write-Body @{ name = "Nova Tech Supplies"; city = "Lahore"; phone = "+92 300 1234567"; email = "sales@example.pk" }
curl.exe --fail-with-body -b $cookieJar -H "Origin: $base" --json "@$bodyFile" -X PUT "$base/api/settings"
```

The frontend's existing browser-local `src/lib/business.ts` profile is **not yet connected** to this API and must be migrated separately by the frontend engineer.

## Customer WhatsApp number on quotations (backend-v2)

`POST /api/operations/run` optionally accepts `customerPhone` as well as the existing fields. Accepted input is a string containing **10–15 digits** with optional leading `+`, spaces, dots, parentheses or hyphens. The backend strips formatting characters and stores only digits (e.g. `+92 300 1234567` becomes `923001234567`); an absent or blank number is omitted. Invalid input returns 422. The number belongs to the authenticated owner's quotation, not to a global customer database.

The optional `Quotation.customerPhone?: string` appears in the `OperationRun.quotation`, quotation list/get results, and approved/rejected quotation responses when present. Existing quotations and requests without the number retain their **original response shape**. Owner scoping, session, Origin validation on POST, input limits, and idempotency protection are unchanged; idempotency compares normalized phone digits.

Authenticated PowerShell example (with the `Write-Body` and `$cookieJar` helpers above):

```powershell
Write-Body @{ customerName = "Ali"; customerEmail = "ali@example.com"; customerPhone = "+92 300 1234567"; request = "I need 10 wireless mice and 5 USB-C hubs" }
curl.exe --fail-with-body -b $cookieJar -H "Origin: $base" --json "@$bodyFile" "$base/api/operations/run"
```

**Provisioning:** `scripts/schema.ts` now declares an **optional** `customerPhone varchar(20)` column on the `quotations` table. Before deploying this branch or sending `customerPhone` in production, provision the new column with `npm run setup:appwrite` using the private setup key. The legacy browser-only phone store is not yet wired to this API and must be switched separately by the frontend engineer.


## Dealers and restock orders (backend-v2)

All routes require an authenticated owner session and return bare JSON DTOs. Create/update/delete/mark-sent enforce the existing exact Origin check and 32 KiB JSON request size limit. Owner IDs and direct permissions are never accepted from clients. Dealers and orders are in private TablesDB tables with empty grants; creation/edit/deletion and order marking produce audit logs.

| Method | Route | Request | Response |
| --- | --- | --- | --- |
| GET | `/api/dealers` | None | `Dealer[]`, 200 |
| POST | `/api/dealers` | `{ name, phone, email?, categories? }` | `Dealer`, 201 |
| PATCH | `/api/dealers/:id` | Non-empty subset of editable dealer fields | `Dealer`, 200 |
| DELETE | `/api/dealers/:id` | None | `{ ok: true }`, 200 |
| POST | `/api/restock-orders/mark-sent` | `{ dealerId, productIds: string[] }` | `{ ok: true }`, 200 |
| GET | `/api/restock-orders?status=sent&since=ISO` | Optional `status=draft|sent` and ISO 8601 `since` | `RestockOrder[]`, 200 |

`Dealer` shape: `{ id, name, phone, email, categories, createdAt, updatedAt }`. The phone field is 10–15 digits (formatting stripped), email defaults to `""`, and categories defaults to `[]` (supplies all categories). Categories support at most 20 unique, nonempty strings of 100 characters maximum. Names are 1–120 characters. Bad values and unknown write fields return HTTP 422; cross-owner record access returns 404.

`RestockOrder` shape: `{ id, dealerId, items: [{ productId, quantity }], status, sentAt?, createdAt }`. Currently only `sent` orders are created by the server; `draft` is reserved for possible future support. `mark-sent` records the owner's **manual confirmation** that a supplier order was sent; the server DOES NOT send WhatsApp messages or emails. Each of the 1–50 unique product IDs must belong to the signed-in owner and have `stock <= lowStockThreshold`. Quantities are calculated from current stock as `max(5, ceil((lowStockThreshold * 4 - stock) / 5) * 5)`. This stores intent only; product inventory is not increased or deducted. The entire operation and audit are transactional. The `since` filter applies to `sentAt`, inclusive, and supports the UI's 3-day recently ordered suppression.

Authenticated PowerShell examples (using `$base`, `$cookieJar`, `$bodyFile`, and `Write-Body` as documented above):

```powershell
Write-Body @{ name = "Ali Traders"; phone = "0300 1112233"; email = "orders@alitraders.pk"; categories = @("Mice", "Cables") }
$dealer = curl.exe --fail-with-body -b $cookieJar -H "Origin: $base" --json "@$bodyFile" "$base/api/dealers" | ConvertFrom-Json
curl.exe --fail-with-body -b $cookieJar "$base/api/dealers"
Write-Body @{ dealerId = $dealer.id; productIds = @("<actual-low-stock-product-id>") }
curl.exe --fail-with-body -b $cookieJar -H "Origin: $base" --json "@$bodyFile" "$base/api/restock-orders/mark-sent"
curl.exe --fail-with-body -b $cookieJar "$base/api/restock-orders?status=sent"
```

Provision `dealers` and `restock_orders` via `npm run setup:appwrite` with the private provisioning key before deploying this branch, then run `npm run check:appwrite`. The new backend API **is not yet wired into** the browser-based `src/lib/dealers.ts` and restock-panel UI; a separate frontend integration is required. The seed script adds two example dealers without replacing previously saved dealers, and existing browser-local dealers are not automatically migrated.
