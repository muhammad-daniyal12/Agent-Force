"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, BellRing, Check, CheckCircle2, Clock, Copy, MessageCircle, Send } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { customerPhoneFor, useBusiness } from "@/lib/business";
import { whatsappLink } from "@/lib/quotation-docs";
import { draftFollowUp, findFollowUps, FOLLOWUPS_CHANGED, formatAge, markDone, readDone, type FollowUp } from "@/lib/followups";
import { formatCurrency, shortId } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, Textarea } from "@/components/ui";

export default function FollowUpsPage() {
  const { data: quotations, error, loading, reload } = useAsync(() => api.quotations());
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => setDone(readDone());
    load();
    window.addEventListener(FOLLOWUPS_CHANGED, load);
    return () => window.removeEventListener(FOLLOWUPS_CHANGED, load);
  }, []);

  const items = quotations ? findFollowUps(quotations, done) : [];
  const owner = items.filter((i) => i.kind === "owner");
  const customer = items.filter((i) => i.kind === "customer");

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Your Follow-up Agent watches every quotation and drafts a nudge when one goes quiet. You choose what to send."
      />

      {/* Agent intro */}
      <Card className="mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fde7f1] text-[#db2777] dark:bg-[#33142a] dark:text-[#f472b6]">
          <BellRing className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-fg">Follow-up Agent</p>
            <Badge tone="success" dot>Active</Badge>
            <Badge>New</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            Reminds you about quotes waiting for your approval, and drafts a polite check-in for customers who haven&apos;t confirmed an approved quote.
          </p>
        </div>
        <dl className="flex gap-6 text-center">
          <div>
            <dd className="text-xl font-semibold text-fg">{loading ? "–" : owner.length}</dd>
            <dt className="text-[11px] text-muted">need your decision</dt>
          </div>
          <div>
            <dd className="text-xl font-semibold text-fg">{loading ? "–" : customer.length}</dd>
            <dt className="text-[11px] text-muted">customer check-ins</dt>
          </div>
        </dl>
      </Card>

      {error ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} title="Nothing to follow up" description="Every quotation is either fresh or already handled. The agent will flag anything that goes quiet." />
        </Card>
      ) : (
        <div className="space-y-6">
          {owner.length > 0 && (
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Waiting for your decision</h2>
              <Card>
                <ul className="stagger divide-y divide-border">
                  {owner.map((f) => <OwnerRow key={f.quotation.id} item={f} />)}
                </ul>
              </Card>
            </section>
          )}
          {customer.length > 0 && (
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Check in with customers</h2>
              <div className="stagger grid grid-cols-1 gap-4 xl:grid-cols-2">
                {customer.map((f) => <CustomerCard key={f.quotation.id} item={f} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function OwnerRow({ item }: { item: FollowUp }) {
  const q = item.quotation;
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
        <Clock className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">
          {q.customerName} <span className="font-mono text-[11px] text-subtle">QUO-{shortId(q.id)}</span>
        </p>
        <p className="text-xs text-muted">
          Waiting {formatAge(item.ageMs)} for your approval · {formatCurrency(q.total)}
        </p>
      </div>
      <Button asChild size="sm" variant="secondary">
        <Link href={`/approvals?id=${q.id}`}>
          Review now <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </Button>
    </li>
  );
}

function CustomerCard({ item }: { item: FollowUp }) {
  const q = item.quotation;
  const biz = useBusiness();
  const [text, setText] = useState(() => draftFollowUp(q, biz));
  const phone = customerPhoneFor(q.id);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Follow-up copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  function done() {
    markDone(q.id);
    toast.success("Marked as followed up", { description: `${q.customerName} · QUO-${shortId(q.id)}` });
  }

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={q.customerName}
        description={`Approved ${formatAge(item.ageMs)} ago · ${formatCurrency(q.total)} · QUO-${shortId(q.id)}`}
        action={<Badge tone="success" dot>Approved</Badge>}
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Send className="h-3.5 w-3.5" aria-hidden /> Drafted by Follow-up Agent · edit before sending
        </p>
        <Textarea aria-label={`Follow-up for ${q.customerName}`} rows={8} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-[12.5px] leading-relaxed" />
        <div className="mt-auto flex flex-wrap gap-2">
          <Button asChild size="sm" className="bg-[#25D366] text-white hover:opacity-90">
            <a href={whatsappLink(text, phone)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" aria-hidden /> {phone ? "WhatsApp customer" : "Send on WhatsApp"}
            </a>
          </Button>
          <Button size="sm" variant="secondary" onClick={copy}>
            <Copy className="h-4 w-4" aria-hidden /> Copy
          </Button>
          <Button size="sm" variant="ghost" onClick={done} className="ml-auto">
            <Check className="h-4 w-4" aria-hidden /> Mark as done
          </Button>
        </div>
      </div>
    </Card>
  );
}
