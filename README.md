# AgentForce: AI Digital Employees for Small Businesses

Small businesses can't afford dedicated staff for customer support, inventory and sales. AgentForce gives them a team of AI agents that handle these repetitive workflows, while the owner approves anything that reaches a customer.

**Core flow:** customer request → **Support Agent** understands it → **Inventory Agent** checks live stock → **Sales Agent** drafts a quotation (PKR, 18% GST) → the **owner approves or rejects** it → the reply goes out on WhatsApp or email → every step is written to an audit log.

## Features

- **Dashboard:** KPIs, weekly quotation chart, hours saved, AI team status, pending approvals, activity log
- **AI Operations:** paste a customer message and watch the 3-agent pipeline run step by step, with tool results and confidence scores
- **AI-drafted replies:** the Support Agent writes the customer reply. After approval: send on WhatsApp, email, copy or download a PDF quotation
- **Inventory:** search, filters, add/edit/delete products, stock indicators, and restock suggestions with a ready-to-send purchase order
- **Approval Center:** review, approve or reject quotations with notes and a full history
- **Agents:** what each agent can do and what it needs human approval for
- Light and dark mode, responsive layout, loading and error states

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and sign in with an owner account created in the Appwrite Console (there is no sign-up page). Backend configuration, table setup and seeding are in [docs/APPWRITE_SETUP.md](docs/APPWRITE_SETUP.md); the implemented API is documented in [docs/API.md](docs/API.md).

To demo the UI without Appwrite, set `NEXT_PUBLIC_USE_MOCK=true` in `.env.local`. The app then runs on built-in demo data and skips login. Leave it unset or `false` in deployment.

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | Frontend | `true` = demo data without login, unset/`false` = real API |
| `APP_ORIGIN` | Backend | Exact site origin, e.g. `https://your-site.appwrite.network` (required for writes) |
| `APP_CURRENCY` | Backend | `PKR` |
| `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `APPWRITE_DATABASE_ID` | Backend | Local development. On Appwrite Sites use the `AGENTFORCE_APPWRITE_*` aliases |
| `LLM_PROVIDER`, `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Backend | Optional model; without one the agents use the built-in fallback |
| `TAX_RATE` | Backend | GST rate, e.g. `0.18` |

See `.env.example` for the full list and comments.

## Deploy on Appwrite Sites

AgentForce is deployed on **Appwrite Sites**, next to the Appwrite database it uses.

1. In the Appwrite Console, open your project and go to **Sites → Create site**.
2. Connect the GitHub repository and choose the `main` branch.
3. Choose **Next.js** as the framework, then check the build settings:
   - Install command: `npm install`
   - Build command: `npm run build`
4. Add the environment variables from the table above, using the `AGENTFORCE_APPWRITE_*` names (Sites reserves `APPWRITE_*`). Set `APP_ORIGIN` to the site's HTTPS address. Don't set `NEXT_PUBLIC_USE_MOCK` in deployment. Full details: [docs/APPWRITE_SETUP.md](docs/APPWRITE_SETUP.md).
5. Deploy. Appwrite redeploys automatically on every push to `main`.

## Screens

| Route | Screen |
|---|---|
| `/` | Dashboard |
| `/operations` | AI Operations: run a customer request through the agent pipeline |
| `/agents` | Support, Inventory and Sales agents |
| `/inventory` | Product catalog and restock suggestions |
| `/approvals` | Approval Center |

## Project structure & ownership

| Path | Owner |
|---|---|
| `src/app/(app)/**`, `src/components/**`, `src/lib/api/**` | Frontend (`feature/frontend`) |
| `src/app/api/**`, `src/lib/server/**`, `src/lib/appwrite/**`, `scripts/**` | Backend (`feature/backend`) |
| `src/types/index.ts` | Shared API contract. Change only after both devs agree |

All UI data goes through `src/lib/api/client.ts`, so switching from demo data to the real backend happens in one place.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Radix UI · Recharts · Appwrite (database + Sites hosting) · LLM tool calling
