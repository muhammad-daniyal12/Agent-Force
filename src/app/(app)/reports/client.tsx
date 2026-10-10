"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Download, FileBarChart, Package, XCircle } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { cn, formatCurrency, formatCurrencyShort } from "@/lib/utils";
import type { Product, Quotation } from "@/types";
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";

function summarize(quotations: Quotation[], products: Product[]) {
  const approved = quotations.filter((q) => q.status === "approved");
  const pending = quotations.filter((q) => q.status === "pending");
  const rejected = quotations.filter((q) => q.status === "rejected");
  const decided = approved.length + rejected.length;

  const byProduct = new Map<string, { name: string; qty: number; value: number }>();
  for (const q of quotations)
    for (const i of q.items) {
      const row = byProduct.get(i.productId) ?? { name: i.name, qty: 0, value: 0 };
      row.qty += i.quantity;
      row.value += i.total;
      byProduct.set(i.productId, row);
    }

  const byCustomer = new Map<string, { name: string; email: string; quotes: number; approvedValue: number }>();
  for (const q of quotations) {
    const key = q.customerEmail.trim().toLowerCase();
    const row = byCustomer.get(key) ?? { name: q.customerName, email: q.customerEmail, quotes: 0, approvedValue: 0 };
    row.quotes += 1;
    if (q.status === "approved") row.approvedValue += q.total;
    byCustomer.set(key, row);
  }

  return {
    quotedValue: quotations.reduce((s, q) => s + q.total, 0),
    approvedValue: approved.reduce((s, q) => s + q.total, 0),
    // Rate over decided quotes only, so pending ones don't drag it down.
    approvalRate: decided ? Math.round((approved.length / decided) * 100) : 0,
    averageQuote: quotations.length ? quotations.reduce((s, q) => s + q.total, 0) / quotations.length : 0,
    status: { approved: approved.length, pending: pending.length, rejected: rejected.length, total: quotations.length },
    topProducts: [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 6),
    topCustomers: [...byCustomer.values()].sort((a, b) => b.approvedValue - a.approvedValue || b.quotes - a.quotes).slice(0, 6),
    stockValue: products.reduce((s, p) => s + p.price * p.stock, 0),
    lowStock: products.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length,
    outOfStock: products.filter((p) => p.stock === 0).length,
    productCount: products.length,
  };
}

/** CSV with a header row; values are quoted so commas in names stay in one cell. */
function quotationsCsv(quotations: Quotation[]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["Quotation", "Date", "Customer", "Email", "Status", "Items", "Subtotal (Rs)", "Discount (Rs)", "Tax (Rs)", "Total (Rs)"];
  const rows = quotations.map((q) => [
    `QUO-${q.id.slice(-6).toUpperCase()}`,
    new Date(q.createdAt).toISOString().slice(0, 10),
    q.customerName,
    q.customerEmail,
    q.status,
    q.items.map((i) => `${i.quantity} x ${i.name}`).join("; "),
    q.subtotal,
    q.discount,
    q.tax,
    q.total,
  ]);
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

function downloadCsv(quotations: Quotation[]) {
  const blob = new Blob(["﻿" + quotationsCsv(quotations)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agentforce-quotations-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Report downloaded", { description: `${quotations.length} quotations exported to CSV` });
}

export default function ReportsPage() {
  const { data, error, loading, reload } = useAsync(() => Promise.all([api.quotations(), api.products()]));
  const [quotations, products] = data ?? [];
  const s = useMemo(() => (quotations && products ? summarize(quotations, products) : null), [quotations, products]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="How your AI team and your sales are performing."
        actions={
          <Button variant="secondary" onClick={() => quotations && downloadCsv(quotations)} disabled={!quotations?.length}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </Button>
        }
      />

      {error ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : loading || !s ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : s.status.total === 0 ? (
        <Card><EmptyState icon={FileBarChart} title="No quotations yet" description="Run a customer request in AI Operations and your reports will fill in here." /></Card>
      ) : (
        <div className="stagger space-y-6">
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {[
              { label: "Total quoted", value: formatCurrencyShort(s.quotedValue), hint: `${s.status.total} quotations` },
              { label: "Approved value", value: formatCurrencyShort(s.approvedValue), hint: formatCurrency(s.approvedValue) },
              { label: "Approval rate", value: `${s.approvalRate}%`, hint: "of decided quotations" },
              { label: "Average quotation", value: formatCurrencyShort(s.averageQuote), hint: "per customer request" },
            ].map((k) => (
              <Card key={k.label} className="p-5">
                <p className="text-[13px] font-medium text-muted">{k.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">{k.value}</p>
                <p className="mt-1 truncate text-xs text-subtle">{k.hint}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Status breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader title="Quotation status" description="Where every quotation stands" />
              <div className="p-5">
                <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${s.status.approved} approved, ${s.status.pending} pending, ${s.status.rejected} rejected`}>
                  {[
                    { n: s.status.approved, cls: "bg-success" },
                    { n: s.status.pending, cls: "bg-warning" },
                    { n: s.status.rejected, cls: "bg-danger" },
                  ].map((seg, i) => seg.n > 0 && <span key={i} className={cn("h-full", seg.cls)} style={{ width: `${(seg.n / s.status.total) * 100}%` }} />)}
                </div>
                <ul className="mt-5 space-y-3">
                  {[
                    { label: "Approved", n: s.status.approved, icon: CheckCircle2, cls: "text-success" },
                    { label: "Pending your approval", n: s.status.pending, icon: Clock, cls: "text-warning" },
                    { label: "Rejected", n: s.status.rejected, icon: XCircle, cls: "text-danger" },
                  ].map(({ label, n, icon: Icon, cls }) => (
                    <li key={label} className="flex items-center gap-3 text-sm">
                      <Icon className={cn("h-4 w-4", cls)} aria-hidden />
                      <span className="flex-1 text-fg">{label}</span>
                      <span className="tabular font-semibold text-fg">{n}</span>
                      <span className="tabular w-10 text-right text-xs text-muted">{Math.round((n / s.status.total) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            {/* Top products */}
            <Card className="lg:col-span-3">
              <CardHeader title="Most requested products" description="Units quoted across all quotations" />
              <ul className="space-y-3.5 p-5">
                {s.topProducts.map((p) => {
                  const max = s.topProducts[0]?.qty || 1;
                  return (
                    <li key={p.name} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 text-[13px] sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
                      <span className="truncate text-fg" title={p.name}>{p.name}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <span className="animate-grow block h-full rounded-full bg-[var(--chart-generated,#7cc313)]" style={{ width: `${(p.qty / max) * 100}%` }} />
                      </span>
                      <span className="tabular text-right">
                        <span className="font-semibold text-fg">{p.qty}</span> <span className="text-muted">units</span>
                        <span className="hidden text-xs text-subtle sm:inline"> · {formatCurrencyShort(p.value)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Top customers */}
            <Card className="lg:col-span-3">
              <CardHeader title="Top customers" description="Ranked by approved value" />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-subtle">
                      <th className="px-5 py-2.5 font-medium">Customer</th>
                      <th className="px-5 py-2.5 text-right font-medium">Quotes</th>
                      <th className="px-5 py-2.5 text-right font-medium">Approved value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {s.topCustomers.map((c) => (
                      <tr key={c.email}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-fg">{c.name}</p>
                          <p className="text-xs text-muted">{c.email}</p>
                        </td>
                        <td className="tabular px-5 py-3 text-right text-fg">{c.quotes}</td>
                        <td className="tabular px-5 py-3 text-right font-medium text-fg">{c.approvedValue ? formatCurrency(c.approvedValue) : <span className="text-subtle">–</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Inventory health */}
            <Card className="lg:col-span-2">
              <CardHeader title="Inventory health" description="From your live catalog" />
              <dl className="divide-y divide-border text-sm">
                {[
                  { k: "Products", v: String(s.productCount) },
                  { k: "Stock value (retail)", v: formatCurrencyShort(s.stockValue) },
                  { k: "Low stock", v: String(s.lowStock), tone: s.lowStock ? "text-warning" : "text-fg" },
                  { k: "Out of stock", v: String(s.outOfStock), tone: s.outOfStock ? "text-danger" : "text-fg" },
                ].map((r) => (
                  <div key={r.k} className="flex items-center justify-between px-5 py-3">
                    <dt className="flex items-center gap-2 text-muted"><Package className="h-3.5 w-3.5" aria-hidden />{r.k}</dt>
                    <dd className={cn("tabular font-semibold", r.tone ?? "text-fg")}>{r.v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
