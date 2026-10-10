# AgentForce Appwrite Cloud schema

Status: manual provisioning specification; this documentation change creates no
remote resources. Use **TablesDB** with tables/columns/rows, not legacy
collections/documents. The API counterpart is [API_CONTRACT.md](./API_CONTRACT.md).

## Database and shared conventions

Create database ID `agentforce`, name `AgentForce`, using the managed TablesDB
serverless option. The runtime IDs are configurable in `.env.local`:

| Environment variable | Exact ID to create |
| --- | --- |
| `APPWRITE_DATABASE_ID` | `agentforce` |
| `APPWRITE_PRODUCTS_TABLE_ID` | `products` |
| `APPWRITE_REQUESTS_TABLE_ID` | `customer_requests` |
| `APPWRITE_QUOTES_TABLE_ID` | `quotes` |
| `APPWRITE_AGENT_RUNS_TABLE_ID` | `agent_runs` |

Appwrite provides `$id`, `$createdAt`, `$updatedAt`, and `$permissions`; do not
create duplicate columns for these. The backend maps IDs/timestamps to the public
DTO fields. Generate row IDs with Appwrite `ID.unique()` and keep them opaque.

Every table has this additional required column:

| Column | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `owner_user_id` | varchar(36) | Yes | None | Verified Appwrite account ID; immutable and assigned by server. |

All columns are scalar (`Array` off). Required columns have no Appwrite default;
the backend supplies their values. Optional columns have no default and may be
stored as null. Table-specific defaults below are backend behavior, not Console
defaults. For integer columns, configure the specified min/max in Console.

Use current `varchar` for short strings and `text` for long payloads. Appwrite
documents `string` as deprecated. Column and index provisioning can be
asynchronous; wait until their status is available before proceeding. See
[Tables and column types](https://appwrite.io/docs/products/databases/tablesdb/tables).

## Permissions: server-only data access

For **each** of the four tables:

- Table enabled: on. Row Security: on.
- Table-level permissions: empty (`[]`) for read/create/update/delete.
- Row-level permissions: empty (`[]`). Every backend `createRow` must explicitly
  pass `permissions: []`; manually seeded rows also have no grants.
- Do not grant `any`, guests, all users, or even per-owner browser writes. The
  frontend communicates only with authenticated AgentForce endpoints.

Appwrite access grants at either table or row level can expose rows; table grants
are not narrowed by Row Security. Therefore keep both levels empty. See
[Database permissions](https://appwrite.io/docs/products/databases/tablesdb/permissions).

The runtime API key can access rows despite empty permissions. This deliberately
makes the backend responsible for verifying sessions and scoping every operation
to `owner_user_id`. A server API key never proves the browser caller's identity.
Cross-owner ID requests must return `404`; no agent tool may bypass this rule.

## Table: products

Stores the owner's real inventory. Add `owner_user_id` plus:

| Column | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `sku` | varchar(64) | Yes | None | Trim, uppercase, `[A-Z0-9_-]+`; unique per owner. |
| `name` | varchar(200) | Yes | None | Nonempty trimmed product name. |
| `description` | varchar(1000) | No | Null | Optional plain text. |
| `unit_price_minor` | integer | Yes | None | Min 0, max 2147483647; no floating-point money. |
| `currency` | enum: `PKR`, `USD` | Yes | None | Set from `APP_CURRENCY`; one currency per deployment. |
| `stock_quantity` | integer | Yes | None | Min 0, max 1000000. |
| `active` | boolean | Yes | Server: true | Inactive products cannot be quoted/approved. |

Indexes (column order is significant):

| Key | Type | Columns and orders | Purpose |
| --- | --- | --- | --- |
| `products_owner_sku` | unique | `owner_user_id ASC`, `sku ASC` | Owner-scoped SKU lookup and duplicate protection. |
| `products_owner_name` | key | `owner_user_id ASC`, `name ASC` | Exact product-name lookup; multiple matches require clarification. |
| `products_owner_created` | key | `owner_user_id ASC`, `$createdAt DESC`, `$id DESC` | Owner inventory pagination. |
| `products_owner_active_created` | key | `owner_user_id ASC`, `active ASC`, `$createdAt DESC`, `$id DESC` | Active-filtered inventory pagination. |

Product ownership and currency are immutable. Use `active: false` rather than
deleting rows referenced by quotes. Approval does not decrement stock in this MVP.

## Table: customer_requests

One row per submitted message/workflow. Add `owner_user_id` plus:

| Column | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `customer_name` | varchar(120) | No | Null | Display label; no customer account required. |
| `message` | text | Yes | None | Backend limit 4000 characters. |
| `status` | enum: `processing`, `needs_clarification`, `completed`, `failed` | Yes | Server: processing | Server-managed workflow state. |
| `assistant_message` | text | No | Null | Backend limit 2000 characters; safe owner-visible reply. |
| `idempotency_key` | varchar(128) | Yes | None | Header value, `[A-Za-z0-9_-]+`; immutable. |
| `request_hash` | varchar(64) | Yes | None | SHA-256 hex of canonical validated input; immutable. |
| `processing_expires_at` | datetime | Yes | None | Workflow start + timeout + 30-second recovery grace. |
| `error_code` | varchar(64) | No | Null | Stable API error code; set only for failed work. |

Indexes:

| Key | Type | Columns and orders | Purpose |
| --- | --- | --- | --- |
| `requests_owner_idempotency` | unique | `owner_user_id ASC`, `idempotency_key ASC` | Claim workflow once; owner-scoped retries. |
| `requests_owner_created` | key | `owner_user_id ASC`, `$createdAt DESC`, `$id DESC` | Owner request history. |
| `requests_owner_status_created` | key | `owner_user_id ASC`, `status ASC`, `$createdAt DESC`, `$id DESC` | Status-filtered history. |
| `requests_owner_status_expiry` | key | `owner_user_id ASC`, `status ASC`, `processing_expires_at ASC` | Conditional workflow publication and timeout recovery. |

No conversation or customer-contact table is needed for this MVP. Read handlers
recover expired processing rows as failed, without launching another LLM run.
Do not remove idempotency records independently of their request rows.

## Table: quotes

One immutable quotation per completed customer request. Add `owner_user_id` plus:

| Column | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `request_id` | varchar(36) | Yes | None | ID of this owner's customer request. |
| `status` | enum: `pending_approval`, `approved`, `rejected` | Yes | Server: pending_approval | Only the owner decision endpoint can leave pending. |
| `currency` | enum: `PKR`, `USD` | Yes | None | Same as all quoted products and `APP_CURRENCY`. |
| `items_json` | text | Yes | None | JSON serialization of the API `items` array; application max 16000 characters. |
| `total_minor` | integer | Yes | None | Min 0, max 2147483647; backend-calculated sum. |
| `summary` | text | Yes | None | Plain text; application max 2000 characters. |
| `decided_by_user_id` | varchar(36) | No | Null | Set from verified owner on decision. |
| `decided_at` | datetime | No | Null | UTC decision timestamp; present only after decision. |

Indexes:

| Key | Type | Columns and orders | Purpose |
| --- | --- | --- | --- |
| `quotes_owner_request` | unique | `owner_user_id ASC`, `request_id ASC` | At most one quote per request; request-detail lookup. |
| `quotes_owner_created` | key | `owner_user_id ASC`, `$createdAt DESC`, `$id DESC` | Owner quotation history. |
| `quotes_owner_status_created` | key | `owner_user_id ASC`, `status ASC`, `$createdAt DESC`, `$id DESC` | Pending/decided lists and conditional decision filtering. |

`items_json` contains 1-10 items with `productId`, `sku`, `name`, `quantity`,
`unitPriceMinor`, `lineTotalMinor`, and `availableQuantityAtCheck` exactly as in
the API contract. This preserves product/price/availability snapshots without
another table. JSON is serialized text in TablesDB and parsed to an array in the
API; validate both its shape and size before writes and on reads.

Plain ID columns replace relationship columns for speed. The backend must verify
that the request and every product belong to the same owner. No automatic cascade
deletes are configured. Names/prices/items/total remain immutable after creation.
`decided_by_user_id` and `decided_at` must be either both null (pending), or both
set (approved/rejected); the deciding ID must equal `owner_user_id`.

## Table: agent_runs

Short owner-visible step records for the workflow. Add `owner_user_id` plus:

| Column | Type | Required | Default | Rules |
| --- | --- | --- | --- | --- |
| `request_id` | varchar(36) | Yes | None | This owner's customer request ID. |
| `agent` | enum: `support`, `inventory`, `sales` | Yes | None | Fixed backend employee identity. |
| `sequence` | integer | Yes | None | Min 1, max 3; support=1, inventory=2, sales=3. |
| `status` | enum: `completed`, `failed`, `skipped` | Yes | None | Persist when a step finishes or is skipped. |
| `summary` | varchar(1000) | Yes | None | Brief plain text outcome; no hidden reasoning or secrets. |
| `duration_ms` | integer | Yes | None | Min 0, max 2147483647; zero for skipped work. |
| `error_code` | varchar(64) | No | Null | Safe stable code for a failed step; otherwise null. |

Indexes:

| Key | Type | Columns and orders | Purpose |
| --- | --- | --- | --- |
| `runs_owner_request_agent` | unique | `owner_user_id ASC`, `request_id ASC`, `agent ASC` | One record per employee per request. |
| `runs_owner_request_sequence` | key | `owner_user_id ASC`, `request_id ASC`, `sequence ASC` | Owner-scoped step list in workflow order. |

Store no prompts, session tokens, raw provider errors, or chain-of-thought. The
original message is stored only in the owner-scoped request row. Agents receive
only the inventory/context required for that owner's workflow.

## Consistency requirements for implementation

- Claim each request via the unique idempotency index before LLM work. Duplicate
  claims fetch the existing owner-scoped row and follow the API replay rules.
- Publish the quote, Sales result, and completed request state together in a short
  TablesDB transaction. Keep external LLM calls outside database transactions.
  Roll back partial publication on failure. Unique quote/request indexes are
  an additional guard against duplicate drafts.
- Decisions must use an atomic conditional update filtered by owner, quote ID,
  and pending status (for example, scoped `updateRows`), checking the affected
  row count. Never call bulk updates with missing filters. Handle zero matches
  and concurrent transaction conflicts by reading the stored decision.
- Preserve the timeout/status guards during publication and recovery. A stale
  original process must not turn a recovered failed request into a completed one.
  Use conditional updates constrained by owner, request ID, processing status,
  and the appropriate deadline; abort publication if exactly one row is not
  affected. Include these guarded writes in the publication/recovery transaction.
- Use short transactions for related writes; [Appwrite transactions](https://appwrite.io/docs/products/databases/tablesdb/transactions)
  provide atomic publication and detect conflicting staged row changes.

## Exactly what to configure manually in Appwrite Console

1. **Project:** Create/select the AgentForce Cloud project and its region. Copy
   the **Project ID** and regional **API endpoint** including `/v1` into
   `APPWRITE_PROJECT_ID` and `APPWRITE_ENDPOINT` in a local `.env.local`.
2. **Web platform:** Under **Apps -> Add app -> Web**, register hostname
   `localhost` for development. Add the exact deployed frontend hostname when
   available (hostname only, no scheme, port, path, or wildcard). If using
   `127.0.0.1`, register it separately and use its origin consistently.
   See [Web platforms](https://appwrite.io/docs/partners/project/platforms).
3. **Auth:** Under **Auth -> Settings**, enable **Email and password**. Anonymous
   login is not needed. Under **Auth -> Users**, create a named demo owner with
   an email and a strong password (at least 12 characters recommended), and copy
   its **User ID** for inventory seeding. Create a second owner for isolation QA.
   Do not store their passwords in the repository or give users Console access.
   See [Auth method settings](https://appwrite.io/docs/partners/project/auth-methods).
4. **Database:** Create managed **TablesDB** database ID `agentforce` and name
   `AgentForce`. Keep the database enabled. Create all four tables with the exact
   IDs listed above and keep each table enabled.
5. **Permissions:** On every table's **Settings**, enable **Row Security** and
   remove all table read/create/update/delete grants. Leave row permissions
   empty as well; there must be no `any` or all-user grants.
6. **Columns:** On each table's **Columns** tab, add the common `owner_user_id`
   column and every table-specific column above. Set exact varchar sizes, enum
   values, required flags, integer bounds, and `Array: off`. Use `text` for the
   long fields; enforce the smaller application limits in backend validation.
   Leave defaults unset, including on required columns. Wait for availability.
7. **Indexes:** On each table's **Indexes** tab, create every named index above,
   using its exact type, column order, and ASC/DESC order. `$createdAt` and `$id`
   are existing system columns used in indexes; do not add them as user columns.
   Wait until all indexes are available before creating data or running the API.
8. **Server API key:** Open **API Keys -> Create API key**, name it
   `agentforce-backend`, set an appropriate expiry, and select only
   `sessions.write`, `rows.read`, and `rows.write`. These support SSR login and
   runtime row operations, including TablesDB transactions. Schema changes are
   performed manually, so do not grant database/table/column/index administration,
   user administration, or key administration scopes. Copy the secret directly
   into `APPWRITE_API_KEY` in local/deployment server settings; never paste it into
   chat or a frontend environment variable. See [API-key scopes](https://appwrite.io/docs/partners/project/api-keys).
9. **Demo inventory:** In **products -> Rows -> Add row**, seed at least two
   products for the demo owner's exact User ID. Supply required values explicitly
   and leave permissions empty. For the API example, use SKU `HEADPHONE-001`, name
   `Wireless Headphones`, `unit_price_minor: 250000`, `currency: PKR`,
   `stock_quantity: 12`, and `active: true`. An out-of-stock second product is
   useful for the clarification demo. Leave other tables empty; backend workflows
   populate them later. If you select USD, update the seed currency accordingly.
10. **Local/deployment environment:** Copy `.env.example` to `.env.local` and fill
    its placeholders. Keep the database/table IDs in sync with Console. Set
    `APP_ORIGIN` to the exact frontend origin and `APP_CURRENCY` before seeding.
    Configure the chosen LLM provider API base, model ID, and key outside Appwrite;
    use server environment secrets on deployment. Neither key belongs in a
    `NEXT_PUBLIC_` variable. Restart the dev server after environment changes.

Use a dedicated hackathon project: API-key row scopes apply across the project,
not just one owner's rows. No Storage bucket, Functions, Realtime, OAuth provider,
or Teams setup is required by this contract.

## Setup completion and handoff

Tell the backend teammate the project region/endpoint, project ID, database/table
IDs (if different), demo owner User ID, selected currency, deployed hostname when
known, and LLM provider/model. These identifiers are not API keys. Configure real
keys and passwords privately in `.env.local` or deployment secrets; confirm
configuration without sharing secret values.

Provisioning is complete when all columns/indexes are available, table/row grants
are empty, the owner account exists, inventory is seeded with its exact User ID,
and private environment settings are filled. After endpoint implementation, QA
must verify anonymous API requests fail, direct browser database access is denied,
and the second owner cannot read/update the first owner's products, requests,
quotes, or runs. Race approve/reject calls and replay workflow submissions to
verify terminal decisions and duplicate protection.
