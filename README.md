# AgentForce: AI Digital Employees for Small Businesses

Small businesses can't afford dedicated staff for support, inventory and sales. AgentForce gives them a team of AI agents that handle repetitive workflows, with a human approving anything sensitive.

**MVP flow:** customer request → Support Agent understands it → Inventory Agent checks stock → Sales Agent drafts a quotation → a human approves or rejects it in the Approval Center → every step is written to an audit log.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

The frontend ships with built-in demo data (`NEXT_PUBLIC_USE_MOCK=true`), so every screen works without the backend. Set it to `false` to use the real `/api` routes.

## Screens

| Route | Screen |
|---|---|
| `/` | Dashboard: KPIs, quotation volume, agent status, pending approvals, activity |
| `/operations` | AI Operations: run a customer request through the 3-agent pipeline |
| `/agents` | Support, Inventory and Sales agents: capabilities, permissions, recent tasks |
| `/inventory` | Product catalog: search, filters, add/edit/delete, stock indicators |
| `/approvals` | Approval Center: review, approve or reject quotations, with history |

## Project structure & ownership

| Path | Owner |
|---|---|
| `src/app/(app)/**`, `src/components/**`, `src/lib/api/**` | Frontend (`feature/frontend`) |
| `src/app/api/**`, `src/lib/server/**`, `src/lib/appwrite/**`, `scripts/**` | Backend (`feature/backend`) |
| `src/types/index.ts` | Shared API contract. Change only after both devs agree |

All UI data goes through `src/lib/api/client.ts`. Switching from demo data to the real backend happens in that one file.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Radix UI · Recharts · Appwrite · LLM tool calling
