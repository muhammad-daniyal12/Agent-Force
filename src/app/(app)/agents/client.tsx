"use client";

import Link from "next/link";
import { ArrowRight, BellRing, Check, Lock, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import type { AgentType } from "@/types";
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { AgentAvatar, agentMeta } from "@/components/agent-meta";

/** The one thing each agent must hand to a human. */
const needsApproval: Record<AgentType, string> = {
  support: "Sending replies to customers",
  inventory: "Changing prices or deleting products",
  sales: "Releasing any quotation",
};

/** Fourth agent: runs in the browser over existing quotations (see lib/followups). */
function FollowUpAgentCard() {
  const capabilities = ["Spots quotes waiting too long", "Drafts polite customer check-ins", "Reminds you to approve pending quotes"];
  return (
    <Card className="hover-lift flex flex-col p-6">
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fde7f1] text-[#db2777] dark:bg-[#33142a] dark:text-[#f472b6]">
          <BellRing className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex gap-1.5">
          <Badge>New</Badge>
          <Badge dot tone="success">Active</Badge>
        </div>
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-fg">Follow-up Agent</h2>
      <p className="mt-1 text-[13px] text-muted">Makes sure no quotation is forgotten</p>
      <ul className="mt-5 space-y-2">
        {capabilities.map((c) => (
          <li key={c} className="flex items-start gap-2 text-[13px] text-fg">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#db2777] dark:text-[#f472b6]" aria-hidden />
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-5">
        <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          <p className="text-muted">
            Needs approval for <span className="text-fg">sending any follow-up message</span>
          </p>
        </div>
        <Link href="/follow-ups" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          Open follow-ups <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

export default function AgentsPage() {
  const { data: agents, error, loading, reload } = useAsync(() => api.agents());

  return (
    <>
      <PageHeader
        title="AI Agents"
        description="Your digital employees, each with one clear job."
        actions={
          <Button asChild>
            <Link href="/operations"><Plus className="h-4 w-4" aria-hidden /> Assign a task</Link>
          </Button>
        }
      />

      {error ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : (
        <>
          <div className="stagger grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {loading || !agents
              ? [...Array(3)].map((_, i) => (
                  <Card key={i} className="space-y-4 p-6">
                    <Skeleton className="h-11 w-11" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-24 w-full" />
                  </Card>
                ))
              : agents.map((agent) => {
                  const meta = agentMeta[agent.type];
                  return (
                    <Card key={agent.id} className="hover-lift flex flex-col p-6">
                      <div className="flex items-start justify-between">
                        <AgentAvatar type={agent.type} size="lg" />
                        <Badge dot tone={agent.status === "offline" ? "neutral" : "success"}>
                          {agent.status === "offline" ? "Offline" : "Active"}
                        </Badge>
                      </div>
                      <h2 className="mt-4 text-lg font-semibold tracking-tight text-fg">{agent.name}</h2>
                      <p className="mt-1 text-[13px] text-muted">{meta.tagline}</p>

                      <ul className="mt-5 space-y-2">
                        {agent.capabilities.slice(0, 3).map((c) => (
                          <li key={c} className="flex items-start gap-2 text-[13px] text-fg">
                            <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.text}`} aria-hidden />
                            {c}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto pt-5">
                        <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
                          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                          <p className="text-muted">
                            Needs approval for <span className="text-fg">{needsApproval[agent.type].toLowerCase()}</span>
                          </p>
                        </div>
                        <p className="tabular mt-3 text-xs text-subtle">{agent.tasksCompleted} tasks completed</p>
                      </div>
                    </Card>
                  );
                })}
            {agents && <FollowUpAgentCard />}
          </div>

          <p className="mt-8 text-center text-[13px] text-muted">
            Coming soon: Scheduling, Admin and Marketing agents in the AgentForce marketplace.
          </p>
        </>
      )}
    </>
  );
}
