"use client";

import Link from "next/link";
import { Ban, CalendarClock, Check, FileSpreadsheet, Lock, Megaphone, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { timeAgo } from "@/lib/utils";
import type { AgentType } from "@/types";
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { AgentAvatar, agentMeta } from "@/components/agent-meta";

const permissions: Record<AgentType, { can: string[]; cannot: string[] }> = {
  support: { can: ["Read customer messages", "Read business FAQ & catalog"], cannot: ["Reply to customers without approval"] },
  inventory: { can: ["Read product stock & prices"], cannot: ["Change prices", "Delete products"] },
  sales: { can: ["Create draft quotations"], cannot: ["Approve or send quotations", "Give discounts outside policy"] },
};

const marketplace = [
  { name: "Scheduling Agent", description: "Books appointments and manages calendars", icon: CalendarClock },
  { name: "Admin Agent", description: "Handles invoices, data entry and paperwork", icon: FileSpreadsheet },
  { name: "Marketing Agent", description: "Drafts campaigns and social posts for review", icon: Megaphone },
];

export default function AgentsPage() {
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.agents(), api.activity(40)]));
  const [agents, activity] = data ?? [];

  return (
    <>
      <PageHeader
        title="AI Agents"
        description="Your digital employees. Each one has a clear job, limited permissions and a human supervisor."
        actions={
          <Button asChild>
            <Link href="/operations"><Plus className="h-4 w-4" aria-hidden /> Assign a task</Link>
          </Button>
        }
      />

      {error ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : (
        <div className="space-y-10">
          <div className="grid gap-5 lg:grid-cols-3">
            {loading || !agents
              ? [...Array(3)].map((_, i) => (
                  <Card key={i} className="space-y-4 p-6">
                    <Skeleton className="h-11 w-11" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </Card>
                ))
              : agents.map((agent) => {
                  const meta = agentMeta[agent.type];
                  const recent = (activity ?? []).filter((a) => a.actor === agent.name).slice(0, 3);
                  const perms = permissions[agent.type];
                  return (
                    <Card key={agent.id} className="flex flex-col">
                      <div className="p-6 pb-5">
                        <div className="flex items-start justify-between">
                          <AgentAvatar type={agent.type} size="lg" />
                          <Badge dot tone={agent.status === "online" ? "success" : agent.status === "busy" ? "warning" : "neutral"}>
                            {agent.status === "online" ? "Available" : agent.status === "busy" ? "Working" : "Offline"}
                          </Badge>
                        </div>
                        <h2 className="mt-4 text-lg font-semibold tracking-tight text-fg">{agent.name}</h2>
                        <p className="mt-1 text-[13px] text-muted">{meta.tagline}</p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                            <p className="tabular text-lg font-semibold text-fg">{agent.tasksCompleted}</p>
                            <p className="text-[11px] text-muted">Tasks completed</p>
                          </div>
                          <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                            <p className="text-lg font-semibold text-fg">{timeAgo(agent.lastActiveAt)}</p>
                            <p className="text-[11px] text-muted">Last active</p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-border px-6 py-4">
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">Capabilities</p>
                        <ul className="space-y-1.5">
                          {agent.capabilities.map((c) => (
                            <li key={c} className="flex items-start gap-2 text-[13px] text-fg">
                              <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.text}`} aria-hidden />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="border-t border-border px-6 py-4">
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">Permissions</p>
                        <ul className="space-y-1.5 text-[13px]">
                          {perms.can.map((c) => (
                            <li key={c} className="flex items-start gap-2 text-fg"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />{c}</li>
                          ))}
                          {perms.cannot.map((c) => (
                            <li key={c} className="flex items-start gap-2 text-muted"><Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />{c}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-auto border-t border-border px-6 py-4">
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">Recent tasks</p>
                        {recent.length === 0 ? (
                          <p className="text-[13px] text-muted">No tasks yet. Run an AI request to see one here.</p>
                        ) : (
                          <ul className="space-y-2">
                            {recent.map((a) => (
                              <li key={a.id} className="flex items-start justify-between gap-3 text-[13px]">
                                <span className="min-w-0 text-fg"><span className="text-muted">{a.action}</span> {a.target}</span>
                                <span className="shrink-0 text-xs text-subtle">{timeAgo(a.createdAt)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </Card>
                  );
                })}
          </div>

          <section aria-labelledby="marketplace">
            <div className="mb-4">
              <h2 id="marketplace" className="text-base font-semibold text-fg">Agent marketplace</h2>
              <p className="text-[13px] text-muted">More digital employees for every industry, all with permissions, audit logs and human approval built in.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {marketplace.map(({ name, description, icon: Icon }) => (
                <Card key={name} className="flex items-start gap-3 border-dashed p-5 shadow-none">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted"><Icon className="h-4 w-4" aria-hidden /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-fg">{name}</p>
                      <Badge><Lock className="h-3 w-3" aria-hidden />Soon</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-muted">{description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
