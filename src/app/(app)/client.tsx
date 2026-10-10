"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, Inbox, Plus, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, isMockMode } from "@/lib/api/client";
import { mockWeeklyVolume } from "@/lib/api/mock-data";
import { useAsync } from "@/lib/use-async";
import { cn, formatCurrency, formatCurrencyShort, greeting, shortId, timeAgo } from "@/lib/utils";
import type { AgentType, Quotation } from "@/types";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { ActorAvatar, AgentAvatar } from "@/components/agent-meta";
import { CountUp } from "@/components/count-up";
import { useBusiness } from "@/lib/business";
import { MINUTES_SAVED_PER_QUOTE } from "@/lib/quotation-docs";

function weeklyVolume(quotations: Quotation[]) {
  if (isMockMode) return mockWeeklyVolume;
  return [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const sameDay = quotations.filter((q) => new Date(q.createdAt).toDateString() === d.toDateString());
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      quotations: sameDay.length,
      approved: sameDay.filter((q) => q.status === "approved").length,
    };
  });
}

const agentBar: Record<AgentType, string> = { support: "bg-support", inventory: "bg-inventory", sales: "bg-sales" };

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() =>
    Promise.all([api.dashboard(), api.agents(), api.quotations(), api.activity(6)]),
  );
  const [stats, agents, quotations, activity] = data ?? [];
  const pending = quotations?.filter((q) => q.status === "pending") ?? [];
  // Computed after mount so the prerendered HTML and the client agree.
  const biz = useBusiness();
  const [hello, setHello] = useState("Welcome back");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- time-based greeting must be computed after hydration
  useEffect(() => setHello(greeting()), []);

  const volume = quotations ? weeklyVolume(quotations) : [];
  const weekGenerated = volume.reduce((s, d) => s + d.quotations, 0);
  const weekApproved = volume.reduce((s, d) => s + d.approved, 0);
  const approvalRate = weekGenerated ? Math.round((weekApproved / weekGenerated) * 100) : 0;
  const hoursSaved = Math.round((weekGenerated * MINUTES_SAVED_PER_QUOTE) / 60);
  const totalTasks = agents?.reduce((s, a) => s + a.tasksCompleted, 0) || 1;

  const kpis = stats
    ? [
        { label: "Pending approvals", value: <CountUp value={stats.pendingApprovals} />, icon: Clock, tone: "text-warning bg-warning-soft", accent: "bg-warning", hint: "Waiting for your review" },
        { label: "Approved value", value: <CountUp value={stats.approvedValue} format={formatCurrencyShort} />, icon: Wallet, tone: "text-success bg-success-soft", accent: "bg-success", hint: formatCurrency(stats.approvedValue) },
        { label: "Quotations", value: <CountUp value={stats.totalQuotations} />, icon: FileText, tone: "text-support bg-support-soft", accent: "bg-support", hint: "Drafted by Sales Agent" },
        { label: "Low stock", value: <CountUp value={stats.lowStockCount} />, icon: AlertTriangle, tone: "text-danger bg-danger-soft", accent: "bg-danger", hint: "Products to restock" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={`${hello}, ${biz.name}`}
        description={quotations ? `Your AI team saved about ${hoursSaved} hours of manual work this week.` : "Here's what your AI team has been working on."}
        actions={
          <Button asChild>
            <Link href="/operations">
              <Plus className="h-4 w-4" aria-hidden /> New request
            </Link>
          </Button>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : (
        <div className="stagger space-y-6">
          {/* KPIs */}
          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {loading || !stats
              ? [...Array(4)].map((_, i) => (
                  <Card key={i} className="p-5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-4 h-7 w-20" />
                    <Skeleton className="mt-2 h-3 w-28" />
                  </Card>
                ))
              : kpis.map(({ label, value, icon: Icon, tone, accent, hint }) => (
                  <Card key={label} className="hover-lift relative overflow-hidden p-5">
                    <span className={cn("absolute inset-x-0 top-0 h-0.5", accent)} aria-hidden />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-muted">{label}</p>
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone)}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                    <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">{value}</p>
                    <p className="mt-1 truncate text-xs text-subtle">{hint}</p>
                  </Card>
                ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Chart */}
            <Card className="lg:col-span-2">
              <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-fg">Quotation volume</h2>
                  <p className="mt-0.5 text-[13px] text-muted">Last 7 days</p>
                </div>
                <dl className="flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />Generated</dt>
                    <dd className="tabular text-lg font-semibold text-fg">{loading ? "–" : weekGenerated}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-[var(--chart-2)]" />Approved</dt>
                    <dd className="tabular text-lg font-semibold text-fg">{loading ? "–" : weekApproved}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Approval rate</dt>
                    <dd className="tabular text-lg font-semibold text-success">{loading ? "–" : `${approvalRate}%`}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Time saved</dt>
                    <dd className="tabular text-lg font-semibold text-primary">{loading ? "–" : `~${hoursSaved}h`}</dd>
                  </div>
                </dl>
              </div>
              <div className="h-64 px-2 py-4 sm:px-4">
                {loading || !quotations ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volume} barGap={4} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradGenerated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={1} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                        </linearGradient>
                        <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={1} />
                          <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: "var(--surface-2)", radius: 6 }}
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--fg)", boxShadow: "var(--shadow-lg)" }}
                        labelStyle={{ color: "var(--fg)", fontWeight: 600, marginBottom: 4 }}
                      />
                      <Bar dataKey="quotations" name="Generated" fill="url(#gradGenerated)" radius={[6, 6, 0, 0]} maxBarSize={24} animationDuration={900} animationBegin={200} />
                      <Bar dataKey="approved" name="Approved" fill="url(#gradApproved)" radius={[6, 6, 0, 0]} maxBarSize={24} animationDuration={900} animationBegin={350} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* AI team */}
            <Card className="flex flex-col">
              <CardHeader
                title="AI team"
                description={agents ? `${agents.filter((a) => a.status !== "offline").length} of ${agents.length} agents active` : "Agent status"}
                action={<Link href="/agents" className="text-[13px] font-medium text-brand hover:underline">View</Link>}
              />
              <ul className="flex-1 divide-y divide-border">
                {loading || !agents
                  ? [...Array(3)].map((_, i) => (
                      <li key={i} className="flex items-center gap-3 px-5 py-4">
                        <Skeleton className="h-9 w-9" />
                        <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-1.5 w-full" /></div>
                      </li>
                    ))
                  : agents.map((agent) => (
                      <li key={agent.id} className="flex items-center gap-3 px-5 py-4">
                        <AgentAvatar type={agent.type} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-fg">{agent.name}</p>
                            <Badge dot tone={agent.status === "online" ? "success" : agent.status === "busy" ? "warning" : "neutral"}>
                              {agent.status === "online" ? "Online" : agent.status === "busy" ? "Working" : "Offline"}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                              <div className={cn("animate-grow h-full rounded-full", agentBar[agent.type])} style={{ width: `${(agent.tasksCompleted / totalTasks) * 100}%` }} />
                            </div>
                            <span className="tabular w-16 text-right text-xs text-muted">{agent.tasksCompleted} tasks</span>
                          </div>
                        </div>
                      </li>
                    ))}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Pending approvals */}
            <Card className="lg:col-span-3">
              <CardHeader
                title="Waiting for your approval"
                description="AI-drafted quotations. Nothing is sent until you approve."
                action={<Link href="/approvals" className="text-[13px] font-medium text-brand hover:underline">View all</Link>}
              />
              {loading ? (
                <div className="space-y-3 p-5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : pending.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="You're all caught up" description="New AI-drafted quotations will appear here." />
              ) : (
                <ul className="stagger divide-y divide-border">
                  {pending.slice(0, 5).map((q) => (
                    <li key={q.id}>
                      <Link href={`/approvals?id=${q.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2 outline-none focus-visible:bg-surface-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-xs font-semibold text-warning">
                          {q.customerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
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
              <CardHeader title="Recent activity" description="Audit trail of every action" />
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
                          <span className="font-medium">{a.actor}</span> <span className="text-muted">{a.action}</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-subtle">{a.target} · {timeAgo(a.createdAt)}</p>
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
