"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, Inbox, Sparkles, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, isMockMode } from "@/lib/api/client";
import { mockWeeklyVolume } from "@/lib/api/mock-data";
import { useAsync } from "@/lib/use-async";
import { cn, formatCurrency, shortId, timeAgo } from "@/lib/utils";
import type { Quotation } from "@/types";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { ActorAvatar, AgentAvatar } from "@/components/agent-meta";

function weeklyVolume(quotations: Quotation[]) {
  if (isMockMode) return mockWeeklyVolume;
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  return days.map((d) => {
    const sameDay = quotations.filter((q) => new Date(q.createdAt).toDateString() === d.toDateString());
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      quotations: sameDay.length,
      approved: sameDay.filter((q) => q.status === "approved").length,
    };
  });
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() =>
    Promise.all([api.dashboard(), api.agents(), api.quotations(), api.activity(8)]),
  );
  const [stats, agents, quotations, activity] = data ?? [];
  const pending = quotations?.filter((q) => q.status === "pending") ?? [];

  const kpis = stats
    ? [
        { label: "Pending approvals", value: String(stats.pendingApprovals), icon: Clock, tone: "text-warning", hint: "Waiting for you" },
        { label: "Approved value", value: formatCurrency(stats.approvedValue), icon: Wallet, tone: "text-success", hint: "All time" },
        { label: "Quotations generated", value: String(stats.totalQuotations), icon: FileText, tone: "text-primary", hint: "By Sales Agent" },
        { label: "Low-stock products", value: String(stats.lowStockCount), icon: AlertTriangle, tone: "text-danger", hint: "Need restocking" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Good morning, Nova Tech"
        description="Here's what your AI team has been working on today."
        actions={
          <Button asChild>
            <Link href="/operations">
              <Sparkles className="h-4 w-4" aria-hidden /> New AI request
            </Link>
          </Button>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {loading || !stats
              ? [...Array(4)].map((_, i) => (
                  <Card key={i} className="p-4 sm:p-5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-4 h-7 w-20" />
                    <Skeleton className="mt-2 h-3 w-16" />
                  </Card>
                ))
              : kpis.map(({ label, value, icon: Icon, tone, hint }) => (
                  <Card key={label} className="p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-muted">{label}</p>
                      <Icon className={cn("h-4 w-4 shrink-0", tone)} aria-hidden />
                    </div>
                    <p className="tabular mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">{value}</p>
                    <p className="mt-1 text-xs text-subtle">{hint}</p>
                  </Card>
                ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Chart */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="Quotation volume"
                description="Last 7 days · generated vs approved"
                action={
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" />Generated</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" />Approved</span>
                  </div>
                }
              />
              <div className="h-64 px-2 py-4 sm:px-4">
                {loading || !quotations ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyVolume(quotations)} barGap={3} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: "var(--surface-2)" }}
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" }}
                      />
                      <Bar dataKey="quotations" name="Generated" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="approved" name="Approved" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Agents */}
            <Card>
              <CardHeader
                title="AI team"
                description={stats ? `${stats.activeAgents} of ${agents?.length ?? 3} agents active` : "Agent status"}
                action={<Link href="/agents" className="text-[13px] font-medium text-primary hover:underline">View</Link>}
              />
              <ul className="divide-y divide-border">
                {loading || !agents
                  ? [...Array(3)].map((_, i) => (
                      <li key={i} className="flex items-center gap-3 px-5 py-4">
                        <Skeleton className="h-9 w-9" />
                        <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-20" /></div>
                      </li>
                    ))
                  : agents.map((agent) => (
                      <li key={agent.id} className="flex items-center gap-3 px-5 py-4">
                        <AgentAvatar type={agent.type} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg">{agent.name}</p>
                          <p className="tabular text-xs text-muted">{agent.tasksCompleted} tasks · active {timeAgo(agent.lastActiveAt)}</p>
                        </div>
                        <Badge dot tone={agent.status === "online" ? "success" : agent.status === "busy" ? "warning" : "neutral"}>
                          {agent.status === "online" ? "Online" : agent.status === "busy" ? "Working" : "Offline"}
                        </Badge>
                      </li>
                    ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* Pending approvals */}
            <Card className="lg:col-span-3">
              <CardHeader
                title="Pending approvals"
                description="Quotations drafted by AI. Nothing is sent until you approve."
                action={<Link href="/approvals" className="text-[13px] font-medium text-primary hover:underline">Open center</Link>}
              />
              {loading ? (
                <div className="space-y-3 p-5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : pending.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="You're all caught up" description="New AI-drafted quotations will appear here for review." />
              ) : (
                <ul className="divide-y divide-border">
                  {pending.slice(0, 4).map((q) => (
                    <li key={q.id}>
                      <Link href={`/approvals?id=${q.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2 outline-none focus-visible:bg-surface-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-fg">{q.customerName}</p>
                            <span className="font-mono text-[11px] text-subtle">QUO-{shortId(q.id)}</span>
                          </div>
                          <p className="truncate text-xs text-muted">{q.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="tabular text-sm font-semibold text-fg">{formatCurrency(q.total)}</p>
                          <p className="text-xs text-subtle">{timeAgo(q.createdAt)}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Activity */}
            <Card className="lg:col-span-2">
              <CardHeader title="Recent activity" description="Audit trail of every agent and admin action" />
              {loading || !activity ? (
                <div className="space-y-4 p-5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : activity.length === 0 ? (
                <EmptyState icon={Inbox} title="No activity yet" />
              ) : (
                <ol className="space-y-4 px-5 py-4">
                  {activity.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <ActorAvatar actor={a.actor} />
                      <div className="min-w-0 flex-1 text-[13px] leading-snug">
                        <p className="text-fg">
                          <span className="font-medium">{a.actor}</span> <span className="text-muted">{a.action}</span>{" "}
                          <span className="font-medium break-words">{a.target}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-subtle">{timeAgo(a.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
