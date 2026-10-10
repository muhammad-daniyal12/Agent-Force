"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, Inbox, Plus, Wallet } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { cn, formatCurrency, formatCurrencyShort, greeting, shortId, timeAgo } from "@/lib/utils";
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { ActorAvatar } from "@/components/agent-meta";

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.dashboard(), api.quotations("pending"), api.activity(6)]));
  const [stats, pending, activity] = data ?? [];
  // Computed after mount so the prerendered HTML and the client agree.
  const [hello, setHello] = useState("Welcome back");
  useEffect(() => setHello(greeting()), []);

  const kpis = stats
    ? [
        { label: "Pending approvals", value: String(stats.pendingApprovals), icon: Clock, tone: "text-warning bg-warning-soft" },
        { label: "Approved value", value: formatCurrencyShort(stats.approvedValue), icon: Wallet, tone: "text-success bg-success-soft" },
        { label: "Quotations", value: String(stats.totalQuotations), icon: FileText, tone: "text-support bg-support-soft" },
        { label: "Low stock", value: String(stats.lowStockCount), icon: AlertTriangle, tone: "text-danger bg-danger-soft" },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={`${hello}, Nova Tech`}
        description="Here's what needs your attention today."
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
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {loading || !stats
              ? [...Array(4)].map((_, i) => (
                  <Card key={i} className="p-5">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="mt-4 h-7 w-20" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </Card>
                ))
              : kpis.map(({ label, value, icon: Icon, tone }) => (
                  <Card key={label} className="p-5">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <p className="tabular mt-4 text-2xl font-semibold tracking-tight text-fg">{value}</p>
                    <p className="mt-0.5 text-[13px] text-muted">{label}</p>
                  </Card>
                ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader
                title="Waiting for your approval"
                action={<Link href="/approvals" className="text-[13px] font-medium text-brand hover:underline">View all</Link>}
              />
              {loading || !pending ? (
                <div className="space-y-3 p-5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : pending.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="You're all caught up" description="New AI-drafted quotations will appear here." />
              ) : (
                <ul className="divide-y divide-border">
                  {pending.slice(0, 5).map((q) => (
                    <li key={q.id}>
                      <Link href={`/approvals?id=${q.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2 outline-none focus-visible:bg-surface-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{q.customerName}</p>
                          <p className="truncate text-xs text-muted">QUO-{shortId(q.id)} · {timeAgo(q.createdAt)}</p>
                        </div>
                        <p className="tabular text-sm font-semibold text-fg">{formatCurrency(q.total)}</p>
                        <ArrowRight className="h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Recent activity" />
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
