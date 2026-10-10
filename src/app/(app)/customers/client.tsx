"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle, Search, Users } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { customerPhoneFor, toWhatsAppNumber } from "@/lib/business";
import { cn, formatCurrency, formatCurrencyShort, formatDate, shortId, timeAgo } from "@/lib/utils";
import type { Quotation } from "@/types";
import { Badge, Card, CardHeader, EmptyState, ErrorState, Input, PageHeader, Skeleton } from "@/components/ui";

interface Customer {
  key: string;
  name: string;
  email: string;
  phone: string;
  quotes: Quotation[];
  approvedValue: number;
  pending: number;
  lastAt: string;
}

/** One row per customer email, newest activity first. */
function groupCustomers(quotations: Quotation[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const q of quotations) {
    const key = q.customerEmail.trim().toLowerCase();
    const c = map.get(key) ?? { key, name: q.customerName, email: q.customerEmail, phone: "", quotes: [], approvedValue: 0, pending: 0, lastAt: q.createdAt };
    c.quotes.push(q);
    if (q.status === "approved") c.approvedValue += q.total;
    if (q.status === "pending") c.pending += 1;
    if (q.createdAt > c.lastAt) {
      c.lastAt = q.createdAt;
      c.name = q.customerName; // latest spelling wins
    }
    c.phone ||= customerPhoneFor(q.id);
    map.set(key, c);
  }
  for (const c of map.values()) c.quotes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .join("")
    .slice(0, 2);

const statusBadge = (s: Quotation["status"]) =>
  s === "approved" ? <Badge tone="success" dot>Approved</Badge> : s === "pending" ? <Badge tone="warning" dot>Pending</Badge> : <Badge tone="danger" dot>Rejected</Badge>;

export default function CustomersPage() {
  const { data: quotations, error, loading, reload } = useAsync(() => api.quotations());
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const customers = useMemo(() => (quotations ? groupCustomers(quotations) : []), [quotations]);
  const needle = query.trim().toLowerCase();
  const visible = needle ? customers.filter((c) => c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle)) : customers;
  const selected = customers.find((c) => c.key === selectedKey) ?? visible[0];
  const repeat = customers.filter((c) => c.quotes.length > 1).length;

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has asked for a quotation, with their history in one place." />

      {error ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : loading ? (
        <Skeleton className="h-96 w-full" />
      ) : customers.length === 0 ? (
        <Card><EmptyState icon={Users} title="No customers yet" description="Customers appear here after your agents prepare their first quotation." /></Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Customers", value: String(customers.length) },
              { label: "Repeat customers", value: String(repeat) },
              { label: "Approved value", value: formatCurrencyShort(customers.reduce((s, c) => s + c.approvedValue, 0)) },
            ].map((k) => (
              <Card key={k.label} className="p-4">
                <p className="text-[13px] text-muted">{k.label}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-fg">{k.value}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Card>
              <div className="border-b border-border p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search customers" />
                </div>
              </div>
              {visible.length === 0 ? (
                <EmptyState icon={Search} title={`No customers match "${query}"`} />
              ) : (
                <ul className="stagger divide-y divide-border">
                  {visible.map((c) => {
                    const active = selected?.key === c.key;
                    return (
                      <li key={c.key}>
                        <button
                          onClick={() => setSelectedKey(c.key)}
                          aria-current={active ? "true" : undefined}
                          className={cn("relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none focus-visible:bg-surface-2 cursor-pointer", active ? "bg-primary-soft/60" : "hover:bg-surface-2")}
                        >
                          {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-fg">{initials(c.name)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-fg">{c.name}</span>
                              {c.quotes.length > 1 && <Badge tone="primary">Repeat</Badge>}
                            </span>
                            <span className="block truncate text-xs text-muted">{c.email}</span>
                          </span>
                          <span className="text-right">
                            <span className="tabular block text-sm font-semibold text-fg">{c.approvedValue ? formatCurrencyShort(c.approvedValue) : "–"}</span>
                            <span className="block text-[11px] text-subtle">{timeAgo(c.lastAt)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {selected && <CustomerDetail key={selected.key} customer={selected} />}
          </div>
        </>
      )}
    </>
  );
}

function CustomerDetail({ customer: c }: { customer: Customer }) {
  const wa = toWhatsAppNumber(c.phone);
  return (
    <Card className="animate-pop-in">
      <div className="flex flex-wrap items-start gap-4 border-b border-border px-5 py-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{initials(c.name)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-fg">{c.name}</h2>
          <p className="text-[13px] text-muted">
            {c.email}
            {c.phone && <> · {c.phone}</>}
          </p>
        </div>
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-[13px] font-medium text-white hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
          </a>
        )}
      </div>

      <dl className="grid grid-cols-3 divide-x divide-border border-b border-border text-center">
        {[
          ["Quotations", String(c.quotes.length)],
          ["Approved value", c.approvedValue ? formatCurrency(c.approvedValue) : "–"],
          ["Waiting on you", String(c.pending)],
        ].map(([k, v]) => (
          <div key={k} className="px-3 py-3">
            <dd className="tabular text-base font-semibold text-fg">{v}</dd>
            <dt className="text-[11px] text-muted">{k}</dt>
          </div>
        ))}
      </dl>

      <CardHeader title="Quotation history" className="border-b-0 pb-2" />
      <ul className="divide-y divide-border">
        {c.quotes.map((q) => (
          <li key={q.id}>
            <Link href={`/approvals?id=${q.id}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">QUO-{shortId(q.id)}</span>
                  {statusBadge(q.status)}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">{q.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm font-semibold text-fg">{formatCurrency(q.total)}</p>
                <p className="text-[11px] text-subtle">{formatDate(q.createdAt)}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
