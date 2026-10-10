# Implemented TablesDB setup and Appwrite Sites deployment

This handoff follows the owner-approved pasted frontend contract. The earlier
`APPWRITE_SCHEMA.md` and `API_CONTRACT.md` remain unchanged for coordination.
The executable current schema is [scripts/schema.ts](../scripts/schema.ts), and
the implemented API is [API.md](./API.md). Do not provision the earlier schema for
this implementation: existing incompatible columns are reported, not migrated
or overwritten. Use a fresh dedicated hackathon database if the old schema was
already provisioned and a coordinated migration is not available.

## Private local configuration

1. In Appwrite Console, select the actual Cloud project and region. Copy its
   regional API endpoint including `/v1` and Project ID. Do not substitute a
   guessed region or the generic global endpoint.
2. Copy `.env.example` to `.env.local` and configure `APPWRITE_ENDPOINT`,
   `APPWRITE_PROJECT_ID`, `APP_ORIGIN=http://localhost:3000`, and table/database IDs.
3. Create a **local runtime/seed key** with only `sessions.write`, `rows.read`,
   `rows.write`; store it as `APPWRITE_API_KEY` in `.env.local`.
4. Create a **separate temporary provisioning key** with `databases.read`,
   `databases.write`, `tables.read`, `tables.write`, `columns.read`, `columns.write`,
   `indexes.read`, `indexes.write`; store it as `APPWRITE_SETUP_API_KEY` locally.
   Revoke it after setup. Do not give schema administration to the Site runtime.
5. Under **Auth -> Settings**, enable email/password. Under **Auth -> Users**,
   create the demo owner and a second owner for isolation QA. Set
   `SEED_OWNER_USER_ID` to the first owner's exact User ID. Keep passwords private.
6. Register Web app hostname `localhost` under **Apps**, and later the exact Site
   hostname. Use hostnames without protocol, path, port, or wildcards.
7. Run `npm run setup:appwrite`, `npm run check:appwrite`, then `npm run seed`. These scripts load
   `.env.local`. Setup only creates missing compatible resources; seed skips
   existing owner/SKU pairs and never resets edited prices/stock. Seed adds 15
   office products, including three low-stock products and one out-of-stock item.

`check:appwrite` is read-only: it checks configuration, reaches the regional API,
and verifies runtime-key reads of the five TablesDB tables without printing row
contents or keys. A missing runtime key or unprovisioned table fails the check;
it does not create resources or deploy. It does not verify write/session scopes;
the authenticated demo flow below verifies those after setup and seed.

For the planned custom domain `agent-force.tech`, keep local
`APP_ORIGIN=http://localhost:3000` during development. Connect the domain through
Appwrite Sites after the application is functional. When that deployment is
authorized and the domain is connected, set the Site's `APP_ORIGIN` to
`https://agent-force.tech` (or the exact hostname the team chooses), register the
matching Web app hostname, and redeploy. Do not change the Appwrite API endpoint
to the website domain.

The setup script refuses unsafe table grants or incompatible required columns,
types, sizes, bounds, enums, and indexes. Review its safe error/HTTP status locally
and inspect Console resource status if provisioning does not finish. Never paste
keys into chat, logs, commits, or the frontend. Local code refuses missing/placeholder
configuration rather than pretending to use a real project.

## Current tables and columns

All tables are enabled with **Row Security on**, **table grants empty**, and
**row grants empty**. Runtime writes explicitly supply `permissions: []`.
Only the authenticated backend exposes business data. Appwrite API keys bypass
permissions, so every business operation is also scoped to the verified owner.
See [Appwrite permissions](https://appwrite.io/docs/products/databases/tablesdb/permissions).

| Table           | Columns (all required unless marked optional)                                                                                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `products`      | `owner_user_id varchar(36)`, `sku varchar(64)`, `name varchar(200)`, `category varchar(100)`, `price float 0..1000000`, `stock integer 0..1000000`, `lowStockThreshold integer 0..1000000`                                                                                                                                                                            |
| `quotations`    | `owner_user_id varchar(36)`, `customerName varchar(120)`, `customerEmail varchar(254)`, `request text`, `itemsJson text`, `subtotal/discount/tax/total float 0..1000000000000`, `status enum(pending,approved,rejected)`, optional `reviewerNote varchar(1000)`, optional `reviewer_user_id varchar(36)`, optional `reviewed_at datetime`, `demo_tax_rate float 0..1` |
| `agent_runs`    | `owner_user_id varchar(36)`, `request text`, `stepsJson mediumtext`, optional `quotationId varchar(36)`, `summary text`, optional `idempotencyKey varchar(128)`, optional `requestHash varchar(64)`                                                                                                                                                                   |
| `activity_logs` | `owner_user_id varchar(36)`, `actor varchar(64)`, `action varchar(200)`, `target varchar(200)`                                                                                                                                                                                                                                                                        |
| `rate_limits`   | `count integer 0..1000000`, `expires_at datetime`; internal rate buckets, not user business records                                                                                                                                                                                                                                                                   |

All columns are scalar and defaults are unset. `$id`, `$createdAt`, `$updatedAt`,
and `$permissions` are supplied by Appwrite, not manually created columns.
`itemsJson` serializes the supplied QuotationItem array; `stepsJson` serializes
the supplied AgentStep array. Text limits are additionally enforced in the API.
Current SDK operations use `TablesDB`, `createTable`, typed column methods,
`createRow`, and transactions. No collection/document CRUD is used.

The seed script and backend use a 60-second transaction TTL, meeting Appwrite
Cloud's minimum. They commit or roll back promptly; this TTL is independent of
the Site's 30-second request timeout. The HTTP test fixture also enforces the
minimum so a shorter transaction TTL cannot pass the backend tests.

Every business table has key index `owner_created` on
`owner_user_id ASC, $createdAt DESC, $id DESC`. Additional indexes:

- products: unique `owner_sku` on `owner_user_id, sku`.
- quotations: key `owner_status_created` on
  `owner_user_id ASC, status ASC, $createdAt DESC, $id DESC`.
- agent_runs: unique `owner_idempotency` on `owner_user_id, idempotencyKey`.
- rate_limits: key `expiry` on `expires_at`.

Wait until columns/indexes are available. Required owner columns are assigned by
the server; no business owner IDs or permissions are accepted from the frontend.

## Appwrite Sites deployment settings

Create/select an **Appwrite Site** in the same project, connect
`muhammad-daniyal12/Agent-Force`, and use the Next.js framework preset with **SSR
enabled**. Keep deployment preparation on `feature/backend`; production should
use the reviewed integrated branch after the team's PR merge. No direct push to
main is required. The Git repository root contains `package.json`, even though
the local checkout folder is named `agentforce`.

| Console setting  | Value                                            |
| ---------------- | ------------------------------------------------ |
| Root directory   | `.`                                              |
| Framework        | Next.js                                          |
| Rendering        | Server-side rendering (SSR)                      |
| Install command  | `npm ci`                                         |
| Build command    | `npm run build`                                  |
| Output directory | `.next`                                          |
| Runtime          | Node.js 22 or newer supported by the preset      |
| Request timeout  | 30 seconds                                       |
| Runtime scopes   | `sessions.write`, `rows.read`, `rows.write` only |

The Next.js `.next` preset output and SSR configuration follow
[Appwrite Sites development settings](https://appwrite.io/docs/products/sites/develop).
The backend uses the default Next.js Node runtime; it does not override this
repository's Cache Components configuration. Do not use static export: it cannot
serve the authenticated route handlers. A nonsecret Console settings blueprint
is in [scripts/appwrite-site.settings.json](../scripts/appwrite-site.settings.json).

Under **Sites -> Settings -> Build -> Scopes**, select the three runtime scopes.
On Sites, the backend takes the exact endpoint/project ID from injected
`APPWRITE_SITE_API_ENDPOINT` and `APPWRITE_SITE_PROJECT_ID`. Each SSR request's
platform-injected `x-appwrite-key` supplies its ephemeral server key. A fresh
client is built per request, and the visitor session is verified independently.
There is no API key in browser code and no stored production key is required.
This follows [Sites SSR credentials](https://appwrite.io/docs/products/sites/rendering/ssr).

## Site environment variables

Set these under **Sites -> Settings -> Environment variables**, then redeploy:

| Variable                                                   | Value / handling                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `APP_ORIGIN`                                               | Exact deployed HTTPS origin, without trailing slash. Use the domain on which users actually access the app. |
| `AGENTFORCE_APPWRITE_DATABASE_ID`                          | `agentforce`, or the separately provisioned current database ID.                                            |
| `LLM_PROVIDER`                                             | `none` for fallback; `gemini`, `openai`, or `anthropic` to enable a provider.                               |
| `GEMINI_MODEL`, `OPENAI_MODEL`, or `ANTHROPIC_MODEL`       | Exact model available in your selected provider account.                                                    |
| `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` | Mark **Secret**; never prefix with NEXT_PUBLIC_.                                                            |
| `TAX_RATE`                                                 | `0.08` is a configurable **demo** setting, not a verified legal rate.                                       |
| `LLM_TIMEOUT_MS`                                           | `12000`                                                                                                     |
| `AGENT_RUN_TIMEOUT_MS`                                     | `24000`                                                                                                     |
| `APP_CURRENCY`                                             | Coordinate demo display currency with the frontend; shared DTOs do not add a currency field.                |

For custom table IDs, set `AGENTFORCE_APPWRITE_PRODUCTS_TABLE_ID`,
`AGENTFORCE_APPWRITE_QUOTATIONS_TABLE_ID`, `AGENTFORCE_APPWRITE_AGENT_RUNS_TABLE_ID`,
`AGENTFORCE_APPWRITE_ACTIVITY_TABLE_ID`, and `AGENTFORCE_APPWRITE_RATE_LIMITS_TABLE_ID`.
Sites reserves Appwrite-prefixed injected variables; use the AGENTFORCE aliases
for your own Appwrite configuration. Only if ephemeral keys are unavailable,
configure `AGENTFORCE_APPWRITE_API_KEY` as a server Secret with the same three
runtime scopes. Never deploy `APPWRITE_SETUP_API_KEY` or `SEED_OWNER_USER_ID`.
See [Sites environment variables](https://appwrite.io/docs/products/sites/environment-variables).

The 24-second workflow budget leaves time below the configured Site timeout;
provider calls reserve eight seconds for persistence and fall back when needed.
Storage failure still returns a safe error rather than inventing inventory.
Changing environment variables requires a new Site deployment.

## Verification and team handoff

For a real AI readiness check, configure `LLM_PROVIDER=gemini`, `GEMINI_MODEL`,
and `GEMINI_API_KEY` privately in `.env.local`, then run `npm run check:ai`.
This project's verified demo model is `gemini-3.1-flash-lite`.
The Support Agent uses Google's official `@google/genai` SDK and a forced,
validated extraction function. Inventory reads actual Appwrite rows; Sales
calculates prices deterministically. Models cannot approve quotes or change stock.
OpenAI and Anthropic adapters remain available.

The operator check reads only `SEED_OWNER_USER_ID`'s catalog and invokes the same
Support Agent function as the workflow. It reports `LLM` or `fallback` and safe
HTTP failure codes; fallback exits with code 1. No database records are written.
It can use a local setup key for this operator check; deployed requests always
use runtime credentials and authenticated owner authorization. This check does
not replace an authenticated HTTP workflow smoke test. Never deploy the setup key.

Run `npm run check:backend`, `npm run test:backend`, and `npm run build`. Automated
tests use the real installed SDK against an isolated HTTP fixture; live Cloud
checks require the actual private configuration. After deployment, use the curl
flow in API.md against the deployed origin and confirm:

1. Authenticated demo request yields three steps and a pending quotation.
2. Approving deducts mouse/hub quantities exactly once and creates owner activity.
3. Rejection retains its note and changes no stock.
4. Anonymous access returns JSON 401; second-owner record IDs return 404.
5. The browser cannot read/write TablesDB rows directly, and server keys are absent
   from client bundles/responses. All table/row grants remain empty.
6. Fallback works with `LLM_PROVIDER=none` and missing provider keys.

Frontend handoff: keep the supplied DTOs and API paths; add/login through the
HTTP-only session flow, use relative API URLs, send editable fields only, handle
JSON error strings and 409 refreshes, and display demo tax settings as demo.
QA/deployment handoff: provision the current schema, preserve owner isolation,
set SSR/scopes/origin/timeout, and smoke-test the actual Appwrite region.

## Backend-v2 business settings provisioning

The new `business_settings` table is provisioned by `npm run setup:appwrite` using the existing private provisioning key. Its table ID defaults to `business_settings` and may be overridden with `APPWRITE_SETTINGS_TABLE_ID` locally or `AGENTFORCE_APPWRITE_SETTINGS_TABLE_ID` on Appwrite Sites. Columns: required `owner_user_id varchar(36)`, `name varchar(120)`, `city varchar(80)`, `phone varchar(20)`, and `email varchar(254)`; index: `owner_created`. The authenticated backend writes empty strings when optional settings are absent. As with other business tables, use Row Security with empty table/row permissions; server API keys still require explicit owner validation.

The new runtime settings API uses the existing `rows.read` and `rows.write` scopes. **Before deploying this branch**, rerun private setup to create the new table and then `npm run check:appwrite` to verify six tables; otherwise `/api/settings` will be unavailable. Schema-admin keys must not be deployed.
