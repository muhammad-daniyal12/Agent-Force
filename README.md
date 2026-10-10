# AgentForce

AgentForce is an AI workforce automation MVP with three cooperating agents:

- **Support Agent** interprets customer requests through a real LLM.
- **Inventory Agent** checks the authenticated owner's live inventory.
- **Sales Agent** calculates quotations for owner approval. Approval deducts stock atomically; rejection preserves stock.

Built with Next.js App Router, TypeScript, Appwrite Cloud TablesDB and Auth, and Google's official Gemini SDK. Hosting uses **Appwrite Sites with server-side rendering (SSR)**.

## Local development

Use Node.js 22 or newer. Run commands from the repository root containing `package.json`:

```bash
npm ci
```

For first-time setup, copy `.env.example` to `.env.local`. Preserve an existing configured `.env.local`; keep credentials private. This file is ignored by Git.

This project's nonsecret configuration is:

```dotenv
APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=6ac9d1880018d89628db
APPWRITE_DATABASE_ID=agentforce
APP_ORIGIN=http://localhost:3000
LLM_PROVIDER=gemini
GEMINI_MODEL=gemini-3.1-flash-lite
```

Configure `APPWRITE_API_KEY` and `GEMINI_API_KEY` privately in `.env.local`. The local runtime Appwrite key requires only `sessions.write`, `rows.read`, and `rows.write`. Create the demo business owner under **Auth → Users** and set `SEED_OWNER_USER_ID` to that user's ID.

For a fresh database, follow [Appwrite setup](docs/APPWRITE_SETUP.md) to configure the separate provisioning key, then run:

```bash
npm run setup:appwrite
npm run check:appwrite
npm run seed
npm run dev
```

Setup creates compatible missing resources. Seeding skips existing owner/SKU pairs and preserves edited stock and prices. Open [localhost:3000](http://localhost:3000); frontend integration uses [docs/API.md](docs/API.md).

## Verify real AI

The Support Agent supports **Gemini, OpenAI, and Anthropic**. The project's verified Gemini demo model is `gemini-3.1-flash-lite`. Missing configuration, provider errors, invalid output, or timeouts trigger deterministic fallback.

```bash
npm run check:ai
```

This read-only check sends a real customer request through the Support Agent and checks matching products against the configured owner's Appwrite inventory. It reports `LLM` or `fallback`; fallback returns a failing exit code. It creates no quotations and changes no stock. An authenticated HTTP workflow needs a separate smoke test.

## Deploy with Appwrite Sites

Use these settings when the team is ready to deploy:

1. Create a **Site** in the existing Appwrite project and connect [muhammad-daniyal12/Agent-Force](https://github.com/muhammad-daniyal12/Agent-Force).
2. Select the reviewed, integrated branch. Backend work is on `feature/backend`; merge through team review before selecting the production branch.
3. Configure the Next.js preset with **SSR enabled**. Authenticated API routes require server execution; do not use static export.

| Setting | Value |
| --- | --- |
| Root directory | `.` |
| Framework | Next.js |
| Rendering | Server-side rendering (SSR) |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `.next` |
| Runtime | Supported Node.js 22 or newer |
| Request timeout | 30 seconds |
| Site scopes | `sessions.write`, `rows.read`, `rows.write` |

`package.json` is at the Git repository root; the local folder name `agentforce` is not a nested directory in GitHub. Settings follow [Appwrite Sites development documentation](https://appwrite.io/docs/products/sites/develop). A Console settings blueprint is in [scripts/appwrite-site.settings.json](scripts/appwrite-site.settings.json).

### Site environment variables

Set these under **Sites → Settings → Environment variables**:

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | Exact deployed HTTPS origin, without trailing slash |
| `AGENTFORCE_APPWRITE_DATABASE_ID` | `agentforce` |
| `LLM_PROVIDER` | `gemini` |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `GEMINI_API_KEY` | Save privately and mark **Secret** |
| `LLM_TIMEOUT_MS` | `12000` |
| `AGENT_RUN_TIMEOUT_MS` | `24000` |
| `APP_CURRENCY` | `PKR`, or the currency coordinated with the frontend |
| `TAX_RATE` | `0.08` — a configurable demo setting, not a verified legal tax rate |

Sites injects `APPWRITE_SITE_API_ENDPOINT` and `APPWRITE_SITE_PROJECT_ID`. The backend uses each SSR request's platform-injected `x-appwrite-key`, limited to the Site scopes above. It separately authenticates the visitor and authorizes owner records. See [Appwrite SSR credentials](https://appwrite.io/docs/products/sites/rendering/ssr).

Keep `.env.local`, the provisioning key, and `SEED_OWNER_USER_ID` off the Site. Never prefix credentials with `NEXT_PUBLIC_`. For custom table IDs or a runtime key fallback, follow [docs/APPWRITE_SETUP.md](docs/APPWRITE_SETUP.md). Sites reserves `APPWRITE_*` names for platform variables; use the documented `AGENTFORCE_APPWRITE_*` aliases for custom configuration. Environment changes require a new deployment. See [Sites environment variables](https://appwrite.io/docs/products/sites/environment-variables).

### Custom domain: agent-force.tech

Once the integrated app works, add `agent-force.tech` under the Site's **Domains** tab. Configure the exact DNS records Appwrite shows at your registrar or DNS provider, then wait for verification and HTTPS readiness. For this apex domain, use Appwrite's supported nameserver delegation or DNS-provider flattening setup; follow [the domain instructions](https://appwrite.io/docs/products/sites/domains).

Set `APP_ORIGIN=https://agent-force.tech`, register `agent-force.tech` as a Web app hostname in the Appwrite project, and redeploy. Keep the Appwrite API endpoint as `https://sgp.cloud.appwrite.io/v1`.

## Validation and security

```bash
npm run check:backend
npm run test:backend
npm run build
```

All protected endpoints authenticate and authorize users. Business reads and writes are scoped to the verified owner. Tables have Row Security enabled with empty table and row grants; the browser has no public database access. The LLM extracts request details and cannot approve quotations, change prices, or mutate stock directly.

Use [docs/API.md](docs/API.md) for the implemented frontend contract and authenticated smoke-test examples, [scripts/schema.ts](scripts/schema.ts) for the current executable schema, and [docs/APPWRITE_SETUP.md](docs/APPWRITE_SETUP.md) for the full setup and deployment handoff. Earlier planning documents remain for coordination; use these implementation guides for the working backend.
