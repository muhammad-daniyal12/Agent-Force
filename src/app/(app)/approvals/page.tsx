"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Inbox, MessageSquareQuote, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { cn, formatCurrency, formatDate, shortId, taxLabel, timeAgo } from "@/lib/utils";
import type { ActivityLog, Quotation } from "@/types";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Textarea } from "@/components/ui";
import { ActorAvatar } from "@/components/agent-meta";
import { notifyQuotationsChanged } from "@/components/layout/app-shell";
import { CustomerReply } from "@/components/customer-reply";

type Tab = "pending" | "approved" | "rejected" | "all";

const statusBadge = (s: Quotation["status"]) =>
  s === "pending" ? <Badge tone="warning" dot>Pending</Badge> : s === "approved" ? <Badge tone="success" dot>Approved</Badge> : <Badge tone="danger" dot>Rejected</Badge>;

export default function ApprovalsPage() {
  return (
    <Suspense fallback={null}>
      <ApprovalCenter />
    </Suspense>
  );
}

function ApprovalCenter() {
  const params = useSearchParams();
  const router = useRouter();
  const selectedId = params.get("id");
  const [tab, setTab] = useState<Tab>("pending");

  const { data, error, loading, reload, setData } = useAsync(() => Promise.all([api.quotations(), api.activity(50)]));
  const [quotations, activity] = data ?? [];

  // Jump to the right tab when deep-linked to a decided quotation.
  useEffect(() => {
    if (!selectedId || !quotations) return;
    const q = quotations.find((x) => x.id === selectedId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync tab once data for a deep link arrives
    if (q && tab !== "all" && q.status !== tab) setTab(q.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, quotations]);

  const counts = useMemo(() => {
    const list = quotations ?? [];
    return {
      pending: list.filter((q) => q.status === "pending").length,
      approved: list.filter((q) => q.status === "approved").length,
      rejected: list.filter((q) => q.status === "rejected").length,
      all: list.length,
    };
  }, [quotations]);

  const list = (quotations ?? []).filter((q) => tab === "all" || q.status === tab);
  const selected = (quotations ?? []).find((q) => q.id === selectedId) ?? (selectedId ? undefined : list[0]);

  const select = (id: string) => router.replace(`/approvals?id=${id}`, { scroll: false });

  function onDecided(updated: Quotation, log: ActivityLog) {
    setData((d) => (d ? [d[0].map((q) => (q.id === updated.id ? updated : q)), [log, ...d[1]]] : d));
    notifyQuotationsChanged();
  }

  return (
    <>
      <PageHeader title="Approval Center" description="Every AI-drafted quotation stops here. You decide what reaches the customer." />

      {error ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* List */}
          <Card className={cn(selectedId && "hidden lg:block")}>
            <div className="flex gap-1 overflow-x-auto border-b border-border p-2" role="tablist" aria-label="Quotation status">
              {(["pending", "approved", "rejected", "all"] as Tab[]).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
                    tab === t ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {t}
                  <span className={cn("tabular rounded-full px-1.5 text-[11px]", t === "pending" && counts.pending > 0 ? "bg-primary text-primary-fg" : "text-subtle")}>{counts[t]}</span>
                </button>
              ))}
            </div>

            {loading && !quotations ? (
              <div className="space-y-2 p-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={tab === "pending" ? CheckCircle2 : Inbox}
                title={tab === "pending" ? "No pending approvals" : `No ${tab === "all" ? "" : tab} quotations`}
                description={tab === "pending" ? "You're all caught up. New AI drafts will show up here." : undefined}
              />
            ) : (
              <ul className="stagger divide-y divide-border">
                {list.map((q) => {
                  const active = selected?.id === q.id;
                  return (
                    <li key={q.id}>
                      <button
                        onClick={() => select(q.id)}
                        className={cn(
                          "relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-surface-2 cursor-pointer",
                          active ? "bg-primary-soft/60" : "hover:bg-surface-2",
                        )}
                        aria-current={active ? "true" : undefined}
                      >
                        {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-fg">{q.customerName}</p>
                            <p className="tabular shrink-0 text-sm font-semibold text-fg">{formatCurrency(q.total)}</p>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted">{q.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
                          <div className="mt-2 flex items-center gap-2">
                            {statusBadge(q.status)}
                            {q.items.some((i) => !i.inStock) && <Badge tone="danger"><AlertTriangle className="h-3 w-3" />Stock</Badge>}
                            <span className="ml-auto text-[11px] text-subtle">{timeAgo(q.createdAt)}</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Detail */}
          <div className={cn(!selectedId && "hidden lg:block")}>
            {loading && !quotations ? (
              <Card className="space-y-4 p-6"><Skeleton className="h-6 w-48" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></Card>
            ) : selected ? (
              <QuotationDetail
                key={selected.id}
                quotation={selected}
                history={(activity ?? []).filter((a) => a.target.includes(shortId(selected.id)))}
                onBack={() => router.replace("/approvals", { scroll: false })}
                onDecided={onDecided}
              />
            ) : (
              <Card><EmptyState icon={MessageSquareQuote} title={selectedId ? "Quotation not found" : "Select a quotation"} description="Choose a quotation from the list to review it." /></Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function QuotationDetail({
  quotation,
  history,
  onBack,
  onDecided,
}: {
  quotation: Quotation;
  history: ActivityLog[];
  onBack: () => void;
  onDecided: (q: Quotation, log: ActivityLog) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const shortage = quotation.items.filter((i) => !i.inStock);

  async function decide(kind: "approve" | "reject") {
    setBusy(kind);
    try {
      const updated = kind === "approve" ? await api.approveQuotation(quotation.id, note.trim()) : await api.rejectQuotation(quotation.id, note.trim());
      onDecided(updated, {
        id: `local_${Date.now()}`,
        actor: "Admin",
        action: kind === "approve" ? "approved quotation" : "rejected quotation",
        target: `QUO-${shortId(quotation.id)} · ${quotation.customerName}`,
        createdAt: new Date().toISOString(),
      });
      toast.success(kind === "approve" ? "Quotation approved" : "Quotation rejected", {
        description: kind === "approve" ? `${updated.customerName} can now receive this quotation. Stock reserved.` : "This draft won't be sent.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="animate-pop-in">
      <div className="border-b border-border px-5 py-4">
        <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-fg lg:hidden cursor-pointer">
          <ArrowLeft className="h-4 w-4" /> All quotations
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-fg">{quotation.customerName}</h2>
              {statusBadge(quotation.status)}
            </div>
            <p className="mt-0.5 text-[13px] text-muted">
              {quotation.customerEmail} · <span className="font-mono">QUO-{shortId(quotation.id)}</span> · {formatDate(quotation.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Total</p>
            <p className="tabular text-2xl font-semibold tracking-tight text-fg">{formatCurrency(quotation.total)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">Customer request</p>
          <blockquote className="rounded-lg border-l-2 border-support bg-support-soft/50 px-4 py-3 text-[13px] leading-relaxed text-fg">“{quotation.request}”</blockquote>
        </div>

        {shortage.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] text-warning" role="note">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden />
            <p>Inventory Agent flagged {shortage.map((i) => i.name).join(", ")} as short on stock. Consider partial fulfilment or a delivery estimate.</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">Order details</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[420px] text-[13px]">
              <thead className="bg-surface-2">
                <tr className="text-left text-[11px] uppercase tracking-wider text-subtle">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotation.items.map((i) => (
                  <tr key={i.productId}>
                    <td className="px-3 py-2.5 text-fg">{i.name}{!i.inStock && <Badge tone="danger" className="ml-2">Short</Badge>}</td>
                    <td className="tabular px-3 py-2.5 text-right text-fg">{i.quantity}</td>
                    <td className="tabular px-3 py-2.5 text-right text-muted">{formatCurrency(i.unitPrice)}</td>
                    <td className="tabular px-3 py-2.5 text-right font-medium text-fg">{formatCurrency(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto mt-3 w-full max-w-64 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular text-fg">{formatCurrency(quotation.subtotal)}</dd></div>
            {quotation.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="tabular text-success">−{formatCurrency(quotation.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">{taxLabel(quotation)}</dt><dd className="tabular text-fg">{formatCurrency(quotation.tax)}</dd></div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt className="text-fg">Total</dt><dd className="tabular text-fg">{formatCurrency(quotation.total)}</dd></div>
          </dl>
        </div>

        <CustomerReply quotation={quotation} />

        {quotation.status === "pending" ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <label htmlFor="note" className="block text-[13px] font-medium text-fg">Note for the audit log <span className="font-normal text-subtle">(optional)</span></label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Approved, offer free delivery" />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => decide("reject")} loading={busy === "reject"} disabled={!!busy} className="hover:text-danger">
                {busy !== "reject" && <X className="h-4 w-4" aria-hidden />} Reject
              </Button>
              <Button variant="success" onClick={() => decide("approve")} loading={busy === "approve"} disabled={!!busy}>
                {busy !== "approve" && <Check className="h-4 w-4" aria-hidden />} Approve & release
              </Button>
            </div>
          </div>
        ) : (
          quotation.reviewerNote && (
            <div className="rounded-lg bg-surface-2 px-4 py-3 text-[13px]">
              <p className="text-xs text-muted">Reviewer note</p>
              <p className="mt-0.5 text-fg">{quotation.reviewerNote}</p>
            </div>
          )
        )}

        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Activity history</p>
          {history.length === 0 ? (
            <p className="text-[13px] text-muted">No logged activity for this quotation yet.</p>
          ) : (
            <ol className="space-y-3">
              {history.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-[13px]">
                  <ActorAvatar actor={a.actor} />
                  <div className="min-w-0 flex-1">
                    <p className="text-fg"><span className="font-medium">{a.actor}</span> <span className="text-muted">{a.action}</span></p>
                    <p className="text-xs text-subtle">{formatDate(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  );
}
