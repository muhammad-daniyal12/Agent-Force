# AgentForce MVP API contract

Status: agreed implementation target for the first backend task. These endpoints
are specified here; they are not implemented by this documentation change.
Repository: `agentforce/`, branch `feature/backend`. Stack: Next.js App Router,
TypeScript, Appwrite Cloud Auth and TablesDB, and a server-side LLM adapter.

## MVP boundaries

Each authenticated Appwrite account is a business owner and owns one isolated
workspace. Its user ID is the workspace boundary. The three AI employees are
backend services, not Appwrite users. Shared teams and customer-facing anonymous
access are outside this MVP. Owners enter customer requests in their dashboard.
Demo accounts are created in Appwrite Console; there is no signup endpoint yet.

Support interprets the request, Inventory checks stored products, and Sales drafts
a quotation. Only the signed-in owner can approve or reject their quotation.
Approval records a decision; it does not reserve/decrement stock, charge a
customer, place an order, or send a message. Availability is checked again at
approval and remains advisory until a future fulfillment workflow exists.

## HTTP and JSON conventions

- Base path: `/api`, on the same origin as the Next.js frontend.
- Request/response JSON uses camelCase. The database uses snake_case; the backend
  maps between them and returns explicit DTOs, never raw Appwrite rows.
- JSON writes require `Content-Type: application/json`, except bodyless logout.
  Reject unknown body fields and query parameters. IDs are opaque strings of
  1-36 characters; validate Appwrite ID syntax before SDK calls.
- All dates are UTC ISO 8601 strings. Optional response fields are always present
  as `null`; optional input fields may be omitted but must not be `null`.
- Trim text inputs, except passwords. SKU is normalized to uppercase. Monetary
  values are integer minor units: `250000` means PKR 2,500.00. One deployment
  currency, `APP_CURRENCY`, is used everywhere: `PKR` or `USD`.
- Price and total fields must fit a nonnegative signed 32-bit integer
  (`0..2147483647`). Calculate with checked integer arithmetic. Taxes, shipping,
  discounts, and currency conversion are outside this MVP.
- Return `Cache-Control: private, no-store` for API responses and do not cache
  inventory reads in Appwrite (`ttl: 0`). Never share authenticated response
  caches across users.
- Accept at most 32 KiB of request JSON. Oversize bodies return `413`.

Success envelope (all success statuses, including `202`):

```json
{
  "data": { "user": { "id": "owner_001", "name": "Demo Owner", "email": "owner@example.com" } },
  "meta": { "requestId": "trace_001" }
}
```

`meta.requestId` identifies this HTTP request for troubleshooting. It is different
from the customer request's `id`. Return it as `X-Request-ID` on errors as well.

List endpoints accept `limit` (default 20, integer 1-100) and `offset` (default 0,
integer 0-10000), ordered by creation time descending, then ID descending for ties.
Pagination counts and filters apply only to the current owner. A page is:

```json
{
  "data": {
    "items": [],
    "pagination": { "limit": 20, "offset": 0, "total": 0, "hasMore": false }
  },
  "meta": { "requestId": "trace_001" }
}
```

## Authentication and authorization

All endpoints below require a valid Appwrite session except `POST /api/auth/login`.
Every protected handler must read the HTTP-only session cookie, create a fresh
session client using `setSession`, and verify the caller using `Account.get()`.
Missing, expired, revoked, or disabled-account sessions return `401`. An upstream
Appwrite outage returns `503`, not a fabricated authentication failure.

Use `agentforce_session` as a host-only cookie containing the Appwrite session
secret: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` on HTTPS, and expiry equal to
the Appwrite session expiry. Disable `Secure` only for local HTTP development.
Never return the secret in JSON or put it in localStorage. Login uses a separate
server client with the `sessions.write` API-key scope; authenticated checks use
the session client. This follows Appwrite's [SSR authentication flow](https://appwrite.io/docs/products/auth/server-side-rendering).

Database access uses the server API key after session verification. That key
bypasses row permissions, so authorization is mandatory in backend code:

1. Derive `owner_user_id` exclusively from the verified account ID.
2. Scope every list, lookup, update, and related-row query to that owner. When
   fetching by ID, verify ownership before returning data or accessing children.
3. Return the same `404 NOT_FOUND` for absent and other-owner resources. Verify
   ownership of every referenced product/request/quote, including agent tools.
4. Reject client-supplied owner IDs, permissions, quote totals, decision actors,
   status changes outside the decision endpoint, and other server-managed fields.

For every state-changing request, including login/logout, require `Origin` to
equal the configured `APP_ORIGIN`; missing/mismatched origins return `403`.
Browser fetch supplies this header; CLI/QA requests must send it explicitly.
Keep frontend/backend on the same origin with no wildcard CORS policy.

Apply backend rate limits even when Appwrite's API key bypasses upstream limits:
login 10 attempts/minute/IP, workflows 5/minute/owner, other protected calls
60/minute/owner. Enforce limits across instances in deployment; an in-memory
limiter is acceptable only for a single-process local demo. Return `429` and
`Retry-After` in seconds. Never log passwords, keys, cookies, or raw provider errors.

## Endpoint summary

| Method | Endpoint | Request | Success `data` / status |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }` | `{ user }`, 200 + cookie |
| POST | `/api/auth/logout` | No body | `{ loggedOut: true }`, 200 + expired cookie |
| GET | `/api/auth/me` | No body | `{ user }`, 200 |
| GET | `/api/products` | Pagination; optional `sku`, `active` | `{ items: Product[], pagination }`, 200 |
| POST | `/api/products` | Product input | `{ product: Product }`, 201 |
| PATCH | `/api/products/:id` | Partial product input | `{ product: Product }`, 200 |
| POST | `/api/requests` | `{ customerName?, message }` + `Idempotency-Key` | `{ request, quote, agentRuns }`, 201; replay 200/202 |
| GET | `/api/requests` | Pagination; optional `status` | `{ items: CustomerRequest[], pagination }`, 200 |
| GET | `/api/requests/:id` | No body | `{ request, quote, agentRuns }`, 200 |
| GET | `/api/quotes` | Pagination; optional `status` | `{ items: Quote[], pagination }`, 200 |
| GET | `/api/quotes/:id` | No body | `{ quote: Quote }`, 200 |
| PATCH | `/api/quotes/:id/decision` | `{ decision: "approve" | "reject" }` | `{ quote: Quote }`, 200 |

### Auth

`POST /api/auth/login` accepts an email (max 254 characters) and a nonempty password
(max 256 characters). Passwords are passed unchanged to Appwrite. The same
`401 INVALID_CREDENTIALS` response covers an unknown email or incorrect password.
It sets a new session cookie and returns the `user` shape shown above; it exposes
only the caller's ID, name, and email. Login while already authenticated returns
`409 ALREADY_AUTHENTICATED`; log out before switching accounts.

```json
{ "email": "owner@example.com", "password": "replace_with_your_demo_password" }
```

`GET /api/auth/me` returns the same `{ user }` payload. Logout revokes the current
Appwrite session and expires the cookie; success is:

```json
{ "data": { "loggedOut": true }, "meta": { "requestId": "trace_001" } }
```

If logout receives an already-invalid session, expire the local cookie and return
`401 UNAUTHENTICATED`. On upstream revocation failure return `503`; do not report
successful revocation.

### Inventory products

Create input (required: `sku`, `name`, `unitPriceMinor`, `stockQuantity`; optional:
`description`, `active`, defaulting to omitted/null and true respectively):

```json
{
  "sku": "HEADPHONE-001",
  "name": "Wireless Headphones",
  "description": "Black, over-ear",
  "unitPriceMinor": 250000,
  "stockQuantity": 12,
  "active": true
}
```

SKU is 1-64 characters matching `[A-Z0-9_-]+` after normalization; name is 1-200
characters; description, if supplied, is 1-1000 characters. Stock is an integer
`0..1000000`. Price uses the common money range. SKU must be unique within the
owner's inventory; duplicates return `409 SKU_ALREADY_EXISTS`.

PATCH accepts any nonempty subset of the same input fields. It never accepts
`currency`, owner fields, or timestamps. Use `active: false` to remove a product
from quoting while retaining quotation history. Concurrent product updates use
last successful write wins in the MVP; quote decisions have stricter rules below.

Both writes return `{ product }` using this `Product` shape. Product lists return
the same shape in `data.items`. `sku` is an exact normalized filter and `active`
accepts only `true` or `false`; omitted filters include all of this owner's rows.

```json
{
  "id": "product_001",
  "sku": "HEADPHONE-001",
  "name": "Wireless Headphones",
  "description": "Black, over-ear",
  "unitPriceMinor": 250000,
  "currency": "PKR",
  "stockQuantity": 12,
  "active": true,
  "createdAt": "2026-10-10T10:00:00.000Z",
  "updatedAt": "2026-10-10T10:00:00.000Z"
}
```

### Customer requests and the three-agent workflow

`POST /api/requests` accepts a message of 1-4000 characters and optional
`customerName` of 1-120 characters. Supply an `Idempotency-Key` header of 1-128
characters matching `[A-Za-z0-9_-]+`; a browser-generated UUID is suitable.

```json
{ "customerName": "Ayesha", "message": "Please quote 2 Wireless Headphones." }
```

The first call persists a `processing` request before any LLM work, then runs the
workflow synchronously within `AGENT_RUN_TIMEOUT_MS` (default 45 seconds):

1. Support returns validated intent and requested items: at most 10 distinct
   products, each with an integer quantity of 1-1000. User text and catalog text
   are untrusted input, never system instructions or permission grants.
2. Inventory resolves each item to an active product owned by the caller using
   a SKU or unambiguous name, then reads real stock and price from TablesDB.
   Duplicate matches are combined before stock checks. Missing/ambiguous items,
   incomplete quantities, or insufficient stock yield `needs_clarification`
   with a useful `assistantMessage` and no quote. Do not silently reduce quantity.
3. Sales prepares a brief owner-visible summary. The backend constructs immutable
   quote item snapshots and calculates totals from inventory prices. LLM output
   cannot invent stock, prices, totals, IDs, or approvals. Create one
   `pending_approval` quote and mark the request `completed` atomically.

Successful new processing returns `201`, including when clarification is needed.
`quote` is `null` until a quote exists. Each `agentRuns` entry uses the shape below,
ordered by `sequence`. Entries are written as steps finish; failed or unnecessary
later steps are recorded as `skipped`. These are short operational summaries,
not prompts, model reasoning, or provider payloads.

```json
{
  "data": {
    "request": {
      "id": "request_001",
      "customerName": "Ayesha",
      "message": "Please quote 2 Wireless Headphones.",
      "status": "completed",
      "assistantMessage": "Two headphones are available. Your quotation is ready for approval.",
      "errorCode": null,
      "createdAt": "2026-10-10T10:01:00.000Z",
      "updatedAt": "2026-10-10T10:01:04.000Z"
    },
    "quote": {
      "id": "quote_001",
      "requestId": "request_001",
      "status": "pending_approval",
      "currency": "PKR",
      "items": [
        {
          "productId": "product_001",
          "sku": "HEADPHONE-001",
          "name": "Wireless Headphones",
          "quantity": 2,
          "unitPriceMinor": 250000,
          "lineTotalMinor": 500000,
          "availableQuantityAtCheck": 12
        }
      ],
      "totalMinor": 500000,
      "summary": "Quotation for two Wireless Headphones.",
      "decidedAt": null,
      "createdAt": "2026-10-10T10:01:04.000Z",
      "updatedAt": "2026-10-10T10:01:04.000Z"
    },
    "agentRuns": [
      { "agent": "support", "sequence": 1, "status": "completed", "summary": "Understood the request for two headphones.", "durationMs": 900, "errorCode": null },
      { "agent": "inventory", "sequence": 2, "status": "completed", "summary": "12 headphones are in stock.", "durationMs": 120, "errorCode": null },
      { "agent": "sales", "sequence": 3, "status": "completed", "summary": "Prepared quotation for owner approval.", "durationMs": 850, "errorCode": null }
    ]
  },
  "meta": { "requestId": "trace_001" }
}
```

The example's `request`, `quote`, and agent entries define the `CustomerRequest`,
`Quote`, and `AgentRun` DTOs. Request statuses are `processing`,
`needs_clarification`, `completed`, or `failed`. Agent statuses are `completed`,
`failed`, or `skipped`. While processing, `assistantMessage` and `errorCode` are
`null`; failed requests expose a safe error code and message. Clarification
requests expose a message and `errorCode: null`.

`GET /api/requests/:id` returns `{ request, quote, agentRuns }` using these shapes.
Lists return `CustomerRequest[]` without embedded quotes/runs; `status` is an
optional exact enum filter. `completed` remains the request status after a quote
decision; the quotation owns its approval status. To answer clarification,
submit a new message with a new idempotency key; conversation threads are deferred.

#### Retry and failure behavior

- Deduplicate on `(owner_user_id, idempotency_key)` with a unique database index.
  Hash the canonical validated body (trimmed message and customerName, omitted
  name represented as null). Same key with a different body returns
  `409 IDEMPOTENCY_CONFLICT`. Keep keys for the lifetime of their request row.
- Replaying a completed/clarification request returns `200` with the stored
  result. Replaying a processing request returns `202` with the same data shape,
  `quote: null`, and `Retry-After: 2`. It does not launch another workflow.
  The original POST is doing the work; no background-job durability is assumed.
- Provider failures persist `failed` and return `502 AGENT_FAILED`; the workflow
  deadline returns `504 AGENT_TIMEOUT`. Include `details.resourceId` when a
  customer request has been persisted. A storage outage returns `503` and may
  prevent failure persistence; retry with the same key to discover stored state.
- Replaying a failed request returns `409 REQUEST_FAILED` with its resource ID.
  Retry failed work intentionally using a new key, after reading its state.
- Persist a processing expiry equal to the workflow deadline plus 30 seconds.
  When a read encounters an expired processing request, atomically mark it failed
  with `AGENT_TIMEOUT` and mark missing steps skipped. The workflow must check
  current status and deadline before its final commit so it cannot publish a
  quote after timeout recovery. This handles interrupted server processes.
- Disable repeated submission while pending. If the browser times out before
  receiving the customer request ID, replay the same POST with the same key.
  Once the ID is known, poll its GET endpoint every two seconds until terminal.

### Quotes and owner decisions

Quote lists and detail use the `Quote` shape above. Optional list `status` accepts
`pending_approval`, `approved`, or `rejected`. `items` contains 1-10 immutable
snapshots. Prices stay as quoted even if the owner later changes the catalog.
There is no edit or send endpoint in this MVP.

```json
{ "decision": "approve" }
```

`PATCH /api/quotes/:id/decision` derives the actor from the authenticated owner.
Only `pending_approval -> approved` or `pending_approval -> rejected` is allowed.
Approval re-reads every referenced product scoped to that owner and checks it is
active, in the quote currency, and has enough stock for the quoted quantity.
Failure returns `409 INVENTORY_CHANGED` and leaves the quote pending. Rejection
requires no stock check. On success, return `{ quote }` with status changed and
`decidedAt` populated; record the deciding user internally.

Use a database-atomic conditional transition, constrained by owner, quote ID,
and current `pending_approval` status. A plain read-then-update is insufficient.
If concurrent decisions race, refetch after the conflict: an identical terminal
decision returns `200` with the stored quote; an opposite terminal decision
returns `409 QUOTE_ALREADY_DECIDED`. Never overwrite a terminal decision.
Check for an existing terminal decision before rechecking stock on a replay.
No LLM call can invoke this owner decision action.

## Error contract

All backend error responses use this envelope, with a stable machine code, safe
message, sanitized `details` object (empty when unnecessary), and trace ID:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the highlighted fields.",
    "details": { "fields": [{ "path": "stockQuantity", "message": "Must be a nonnegative integer." }] }
  },
  "meta": { "requestId": "trace_001" }
}
```

| HTTP | Code | Meaning / frontend action |
| --- | --- | --- |
| 400 | `INVALID_JSON`, `INVALID_QUERY` | Fix malformed JSON or query syntax. |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | Return to login or show generic login failure. |
| 403 | `FORBIDDEN` | Origin/CSRF check failed; do not retry automatically. |
| 404 | `NOT_FOUND` | Missing resource or not owned by the caller. |
| 405 | `METHOD_NOT_ALLOWED` | Unsupported HTTP method; include `Allow`. |
| 409 | `ALREADY_AUTHENTICATED`, `SKU_ALREADY_EXISTS` | Resolve session or SKU conflict. |
| 409 | `IDEMPOTENCY_CONFLICT`, `REQUEST_FAILED` | Follow request retry rules. |
| 409 | `QUOTE_ALREADY_DECIDED`, `INVENTORY_CHANGED` | Refetch the quote and inventory. |
| 413 | `PAYLOAD_TOO_LARGE` | Reduce the input body below 32 KiB. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Send JSON with the correct content type. |
| 422 | `VALIDATION_ERROR` | Show `details.fields`; invalid caller input or unsupported amount bounds. |
| 429 | `RATE_LIMITED` | Respect `Retry-After`. |
| 502 | `AGENT_FAILED` | LLM unavailable or returned unusable output after bounded validation/retry. |
| 503 | `SERVICE_UNAVAILABLE` | Storage/auth service unavailable or configuration missing. |
| 504 | `AGENT_TIMEOUT` | Workflow exceeded its deadline. |
| 500 | `INTERNAL_ERROR` | Unexpected failure; show message and trace ID. |

Invalid caller input/unsupported amounts use `422`; unusable model output uses
`502`, never a caller validation error. Error details must not contain stack
traces, raw Appwrite/LLM responses, prompts, credentials, or another owner's data.

## Frontend integration requirements

1. Use relative `/api/...` URLs with `credentials: "same-origin"`. The backend
   sets/reads the session cookie; the frontend needs no Appwrite or LLM keys.
2. Load `/api/auth/me` to establish the user; handle `401` by showing login.
   Use `POST /api/auth/login` and `/api/auth/logout` for session changes.
3. Treat the documented envelope as authoritative: branch on `response.ok`,
   then read `data` or `error`. Do not expect Appwrite `$id` or `rows` properties.
4. Generate one idempotency key per intentional customer request and preserve it
   across network retries. Allow at least 50 seconds for the synchronous workflow.
   Use GET polling after a known request ID; stop on terminal states or logout.
5. Show all three agent summaries/statuses from the API. Display clarification
   messages separately from infrastructure errors. Show an approval action only
   for `pending_approval` quotes; refetch after any decision conflict.
6. Render customer/model text as escaped text, never untrusted HTML. Format
   money using the supplied currency and minor units; display UTC dates locally.
7. Clear cached owner data on logout/account switch. Never send owner IDs,
   quote prices/totals, Appwrite permissions, or provider configuration as inputs.

No frontend components, runtime handlers, SDK dependencies, or deployment changes
are part of this first task. Provisioning requirements are in
[APPWRITE_SCHEMA.md](./APPWRITE_SCHEMA.md).
