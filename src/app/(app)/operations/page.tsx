"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  MessageSquareText,
  Play,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { cn, formatCurrency, shortId } from "@/lib/utils";
import type { AgentStep, AgentType, OperationRun, Quotation } from "@/types";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { AgentAvatar, agentMeta } from "@/components/agent-meta";
import { notifyQuotationsChanged } from "@/components/layout/app-shell";

const samples = [
  {
    label: "Office setup",
    customerName: "Ali Raza",
    customerEmail: "ali@finlytics.pk",
    request: "Assalam o Alaikum! We're setting up a new office in Gulberg. I need 10 wireless mice, 10 mechanical keyboards and 5 USB-C hubs. Can you send me a quotation?",
  },
  {
    label: "Low stock",
    customerName: "Zara Hussain",
    customerEmail: "zara@pixelcraft.pk",
    request: "Please quote 12 HD webcams and 6 noise cancelling headsets for our remote team. Urgent, need them this week.",
  },
  {
    label: "Big order",
    customerName: "Hamza Qureshi",
    customerEmail: "hamza@vertexlogistics.pk",
    request: "Need 8 x 27 inch monitors, 8 laptop stands and 4 thunderbolt docks for our operations floor in Karachi.",
  },
  {
    label: "General question",
    customerName: "Maria Lopez",
    customerEmail: "maria@example.com",
    request: "What are your opening hours on Saturday?",
  },
];

type NodeKey = AgentType | "approval";
type NodeState = "waiting" | "active" | "done" | "failed" | "skipped" | "attention";

const nodes: { key: NodeKey; label: string; sub: string; running: string }[] = [
  { key: "support", label: "Support", sub: "Understands request", running: "Reading the customer message…" },
  { key: "inventory", label: "Inventory", sub: "Checks live stock", running: "Checking stock levels…" },
  { key: "sales", label: "Sales", sub: "Drafts quotation", running: "Calculating pricing, discount & GST…" },
  { key: "approval", label: "You", sub: "Approve or reject", running: "" },
];

const nodeTone: Record<NodeKey, { text: string; bg: string; soft: string; icon: LucideIcon }> = {
  support: { text: "text-support", bg: "bg-support", soft: "bg-support-soft", icon: agentMeta.support.icon },
  inventory: { text: "text-inventory", bg: "bg-inventory", soft: "bg-inventory-soft", icon: agentMeta.inventory.icon },
  sales: { text: "text-sales", bg: "bg-sales", soft: "bg-sales-soft", icon: agentMeta.sales.icon },
  approval: { text: "text-primary", bg: "bg-primary", soft: "bg-primary-soft", icon: UserCheck },
};

type Phase = "idle" | "running" | "revealing" | "done" | "error";

const REVEAL_MS = 700;

export default function OperationsPage() {
  const [form, setForm] = useState({ customerName: "", customerEmail: "", request: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState<OperationRun | null>(null);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [visible, setVisible] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function validate() {
    const next: Record<string, string> = {};
    if (!form.customerName.trim()) next.customerName = "Customer name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.customerEmail)) next.customerEmail = "Enter a valid email";
    if (form.request.trim().length < 10) next.request = "Describe the request in at least 10 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function start() {
    if (!validate()) return;
    timers.current.forEach(clearTimeout);
    setRun(null);
    setQuotation(null);
    setVisible(0);
    setRunError(null);
    setPhase("running");
    try {
      const result = await api.runOperation(form);
      setRun(result);
      setPhase("revealing");
      // Reveal agent steps one at a time so the hand-off between agents is visible.
      result.steps.forEach((_, i) => timers.current.push(setTimeout(() => setVisible(i + 1), i * REVEAL_MS)));
      timers.current.push(
        setTimeout(() => {
          setPhase("done");
          setQuotation(result.quotation);
          if (result.quotation) {
            notifyQuotationsChanged();
            toast.success("Quotation drafted", { description: "It's waiting for your approval." });
          }
        }, result.steps.length * REVEAL_MS),
      );
    } catch (err) {
      setPhase("error");
      setRunError(err instanceof ApiError ? err.message : "The agents couldn't finish this request.");
    }
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    setRun(null);
    setQuotation(null);
    setPhase("idle");
    setVisible(0);
    setRunError(null);
    setForm({ customerName: "", customerEmail: "", request: "" });
    setErrors({});
  }

  const busy = phase === "running" || phase === "revealing";
  const shownSteps = run ? run.steps.slice(0, visible) : [];

  function stateOf(key: NodeKey): { state: NodeState; note: string } {
    if (key === "approval") {
      if (phase !== "done") return { state: "waiting", note: "Waiting" };
      if (!quotation) return { state: "skipped", note: "Not needed" };
      if (quotation.status === "approved") return { state: "done", note: "Approved" };
      if (quotation.status === "rejected") return { state: "failed", note: "Rejected" };
      return { state: "attention", note: "Needs your review" };
    }
    if (phase === "error") return { state: key === "support" ? "failed" : "waiting", note: key === "support" ? "Failed" : "Waiting" };
    const step = shownSteps.find((s) => s.agent === key);
    if (step) return { state: step.status === "failed" ? "failed" : "done", note: `Done · ${(step.durationMs / 1000).toFixed(1)}s` };
    if (phase === "running" && key === "support") return { state: "active", note: "Working…" };
    if (phase === "revealing" && run) {
      const next = run.steps[visible];
      if (next?.agent === key) return { state: "active", note: "Working…" };
    }
    if (phase === "done") return { state: "skipped", note: "Not needed" };
    return { state: "waiting", note: "Waiting" };
  }

  const activeNode = nodes.find((n) => stateOf(n.key).state === "active");

  return (
    <>
      <PageHeader
        title="AI Operations"
        description="Paste a customer request. Your agents understand it, check stock and draft a quotation. You make the final call."
        actions={
          phase === "idle" ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-fg shadow-card">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              3 agents online
            </span>
          ) : (
            <Button variant="secondary" onClick={reset} disabled={busy}>
              <RotateCcw className="h-4 w-4" aria-hidden /> New request
            </Button>
          )
        }
      />

      {/* Pipeline */}
      <Card className="mb-6 px-4 py-5 sm:px-8 sm:py-6">
        <ol className="grid grid-cols-4" aria-label="Agent pipeline">
          {nodes.map((node, i) => {
            const { state, note } = stateOf(node.key);
            const tone = nodeTone[node.key];
            const Icon = tone.icon;
            const next = nodes[i + 1];
            const lit = state === "done" && next && stateOf(next.key).state !== "waiting";
            return (
              <li key={node.key} className="relative flex flex-col items-center text-center">
                {next && (
                  <span className="absolute left-[calc(50%+30px)] right-[calc(-50%+30px)] top-[23px] h-[3px] overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <span
                      className="block h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{ width: lit ? "100%" : "0%", background: `linear-gradient(90deg, var(--${node.key === "approval" ? "primary" : node.key}), var(--${next.key === "approval" ? "primary" : next.key}))` }}
                    />
                  </span>
                )}
                <div
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300",
                    state === "done" && cn(tone.bg, "text-surface shadow-card"),
                    state === "active" && cn(tone.soft, tone.text, "animate-halo"),
                    state === "attention" && "bg-warning-soft text-warning animate-halo",
                    state === "failed" && "bg-danger-soft text-danger",
                    (state === "waiting" || state === "skipped") && cn(tone.soft, tone.text, "opacity-70"),
                  )}
                >
                  {state === "done" ? <Check className="h-5 w-5" strokeWidth={2.5} /> : state === "failed" ? <X className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  {state === "active" && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface shadow-card">
                      <Loader2 className={cn("h-3 w-3 animate-spin", tone.text)} />
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[13px] font-semibold text-fg sm:text-sm">{node.label}</p>
                <p className="hidden text-xs text-muted sm:block">{node.sub}</p>
                <p
                  className={cn(
                    "mt-1 text-[11px] font-medium sm:text-xs",
                    state === "done" ? tone.text : state === "active" ? tone.text : state === "attention" ? "text-warning" : state === "failed" ? "text-danger" : "text-subtle",
                    state === "done" && node.key === "approval" && "text-success",
                  )}
                >
                  {note}
                </p>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Request form */}
        <Card className="overflow-hidden lg:sticky lg:top-8">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-primary" aria-hidden /> Customer request
              </span>
            }
            description="From email, WhatsApp, chat or phone"
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
            className="space-y-4 p-5"
            noValidate
          >
            <div>
              <p className="mb-2 text-[13px] font-medium text-fg">Try an example</p>
              <div className="flex flex-wrap gap-2">
                {samples.map((s) => {
                  const selected = form.request === s.request;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setForm({ customerName: s.customerName, customerEmail: s.customerEmail, request: s.request });
                        setErrors({});
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
                        selected ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted hover:border-primary hover:text-primary",
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer name" htmlFor="customerName" error={errors.customerName}>
                <Input
                  id="customerName"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Ali Raza"
                  disabled={busy}
                  aria-invalid={!!errors.customerName}
                />
              </Field>
              <Field label="Email" htmlFor="customerEmail" error={errors.customerEmail}>
                <Input
                  id="customerEmail"
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  placeholder="ali@company.pk"
                  disabled={busy}
                  aria-invalid={!!errors.customerEmail}
                />
              </Field>
            </div>

            <Field label="Message" htmlFor="request" error={errors.request}>
              <Textarea
                id="request"
                rows={6}
                value={form.request}
                onChange={(e) => setForm({ ...form, request: e.target.value })}
                placeholder="e.g. I need 10 wireless mice and 5 USB-C hubs, what's the price?"
                disabled={busy}
                aria-invalid={!!errors.request}
              />
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {!busy && <Play className="h-4 w-4" aria-hidden />}
              {busy ? "Agents working…" : "Run AI agents"}
            </Button>

            <p className="flex items-start gap-2 rounded-lg bg-primary-soft px-3 py-2.5 text-xs text-fg">
              <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-primary" aria-hidden />
              Agents only draft. Nothing reaches the customer until a human approves it.
            </p>
          </form>
        </Card>

        {/* Execution log + result */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Execution log"
              description={activeNode ? activeNode.running : "Every agent step and tool result, in order"}
              action={
                phase === "done" ? <Badge tone="success" dot>Completed</Badge>
                : busy ? <Badge tone="primary"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />Running</Badge>
                : phase === "error" ? <Badge tone="danger" dot>Failed</Badge>
                : <Badge>Ready</Badge>
              }
            />
            <div className="p-5" aria-live="polite">
              {phase === "idle" ? (
                <IdlePanel />
              ) : phase === "error" ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger"><X className="h-5 w-5" /></div>
                  <p className="text-sm font-medium text-fg">Run failed</p>
                  <p className="max-w-sm text-[13px] text-muted">{runError}</p>
                  <Button variant="secondary" size="sm" onClick={start}>Try again</Button>
                </div>
              ) : (
                <ol>
                  {shownSteps.map((step, i) => (
                    <StepRow key={step.id} step={step} last={i === shownSteps.length - 1 && !activeNode} />
                  ))}
                  {activeNode && activeNode.key !== "approval" && <WorkingRow agent={activeNode.key} label={activeNode.running} />}
                </ol>
              )}
            </div>
          </Card>

          {phase === "done" && run && (
            <div className="animate-step-in">
              {quotation ? (
                <QuotationResult quotation={quotation} summary={run.summary} onChange={setQuotation} />
              ) : (
                <Card className="flex items-start gap-3 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-support-soft text-support"><MessageSquareText className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-medium text-fg">No quotation needed</p>
                    <p className="mt-1 text-[13px] text-muted">{run.summary}</p>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function IdlePanel() {
  return (
    <div className="flex flex-col items-center px-2 py-8 text-center">
      <div className="flex -space-x-2">
        {(["support", "inventory", "sales"] as AgentType[]).map((t) => (
          <div key={t} className="rounded-xl ring-4 ring-surface">
            <AgentAvatar type={t} size="lg" />
          </div>
        ))}
      </div>
      <p className="mt-5 text-base font-semibold text-fg">Your AI team is ready</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">
        Pick an example or paste a real customer message. Each agent&apos;s reasoning and tool results will appear here as they work.
      </p>
      <dl className="mt-7 grid w-full max-w-md grid-cols-3 divide-x divide-border rounded-xl border border-border">
        {[
          ["3", "agents online"],
          ["~3s", "per request"],
          ["0", "sent unapproved"],
        ].map(([value, label]) => (
          <div key={label} className="px-3 py-3">
            <dt className="sr-only">{label}</dt>
            <dd className="tabular text-lg font-semibold text-fg">{value}</dd>
            <dd className="text-[11px] text-muted">{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function WorkingRow({ agent, label }: { agent: AgentType; label: string }) {
  const meta = agentMeta[agent];
  return (
    <li className="animate-step-in flex gap-4">
      <AgentAvatar type={agent} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", meta.text)}>{meta.label} agent</p>
        <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-fg">
          <Loader2 className={cn("h-3.5 w-3.5 animate-spin", meta.text)} aria-hidden /> {label}
        </p>
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="h-2.5 w-3/4 animate-pulse rounded bg-surface-2" />
          <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
    </li>
  );
}

function StepRow({ step, last }: { step: AgentStep; last: boolean }) {
  const [open, setOpen] = useState(true);
  const meta = agentMeta[step.agent];
  const failed = step.status === "failed";

  return (
    <li className={cn("animate-step-in relative flex gap-4", !last && "pb-6")}>
      {!last && <span className="absolute bottom-0 left-[17px] top-10 w-px bg-border-strong" aria-hidden />}
      <div className="relative">
        <AgentAvatar type={step.agent} />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface">
          {failed ? <X className="h-3 w-3 text-danger" /> : <Check className="h-3 w-3 text-success" strokeWidth={3} />}
        </span>
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn("text-[11px] font-semibold uppercase tracking-wider", meta.text)}>{meta.label} agent</p>
          <span className="tabular text-[11px] text-subtle">{(step.durationMs / 1000).toFixed(1)}s</span>
        </div>
        <p className="mt-0.5 text-sm font-medium text-fg">{step.title}</p>
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 bg-surface-2 px-3 py-2 text-left text-xs font-medium text-muted hover:text-fg cursor-pointer"
            aria-expanded={open}
          >
            <Wrench className="h-3.5 w-3.5" aria-hidden />
            <span className="font-mono text-fg">{step.tool ?? "reasoning"}</span>
            <span>result</span>
            <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} aria-hidden />
          </button>
          {open && <div className="px-3 py-3"><ToolOutput step={step} /></div>}
        </div>
      </div>
    </li>
  );
}

type Row = Record<string, unknown>;

/** Renders known tool outputs as readable UI; anything else falls back to JSON. */
function ToolOutput({ step }: { step: AgentStep }) {
  const out = step.output;

  if (step.agent === "support" && out && typeof out === "object" && "items" in out) {
    const o = out as { intent?: string; urgency?: string; sentiment?: string; items?: { productQuery: string; quantity: number }[] };
    return (
      <div className="space-y-3 text-[13px]">
        <div className="flex flex-wrap gap-2">
          {o.intent && <Badge tone="support">{o.intent.replace(/_/g, " ")}</Badge>}
          {o.urgency && <Badge tone={o.urgency === "high" ? "danger" : "neutral"}>urgency: {o.urgency}</Badge>}
          {o.sentiment && <Badge>sentiment: {o.sentiment}</Badge>}
        </div>
        {o.items && o.items.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {o.items.map((it, i) => (
              <li key={i} className="rounded-md border border-border px-2 py-1 text-xs text-fg">
                <span className="tabular font-semibold">{it.quantity}×</span> {it.productQuery}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (Array.isArray(out) && out.length > 0 && typeof out[0] === "object" && out[0] && "available" in (out[0] as Row)) {
    const rows = out as { sku?: string; name: string; requested: number; available: number; inStock: boolean }[];
    return (
      <div className="-mx-3 -my-3 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-subtle">
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">Requested</th>
              <th className="px-3 py-2 text-right font-medium">Available</th>
              <th className="px-3 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-fg">{r.name}{r.sku && <span className="ml-1.5 font-mono text-[11px] text-subtle">{r.sku}</span>}</td>
                <td className="tabular px-3 py-2 text-right text-fg">{r.requested}</td>
                <td className="tabular px-3 py-2 text-right text-fg">{r.available}</td>
                <td className="px-3 py-2 text-right">{r.inStock ? <Badge tone="success">In stock</Badge> : <Badge tone="danger">Short</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (out && typeof out === "object" && "total" in out) {
    const o = out as { subtotal?: number; discount?: number; tax?: number; total: number; discountRate?: number };
    return (
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
        {[
          ["Subtotal", o.subtotal],
          [`Discount${o.discountRate ? ` (${Math.round(o.discountRate * 100)}%)` : ""}`, o.discount !== undefined ? -o.discount : undefined],
          ["GST 18%", o.tax],
          ["Total", o.total],
        ].map(([label, value]) =>
          value === undefined ? null : (
            <div key={label as string}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className={cn("tabular font-medium text-fg", label === "Total" && "text-sales")}>{formatCurrency(value as number)}</dd>
            </div>
          ),
        )}
      </dl>
    );
  }

  return <pre className="max-h-56 overflow-auto font-mono text-xs leading-relaxed text-muted">{JSON.stringify(out, null, 2)}</pre>;
}

function QuotationResult({ quotation, summary, onChange }: { quotation: Quotation; summary: string; onChange: (q: Quotation) => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const shortage = quotation.items.some((i) => !i.inStock);

  async function decide(kind: "approve" | "reject") {
    setBusy(kind);
    try {
      const updated = kind === "approve" ? await api.approveQuotation(quotation.id) : await api.rejectQuotation(quotation.id);
      onChange(updated);
      notifyQuotationsChanged();
      toast.success(kind === "approve" ? "Quotation approved" : "Quotation rejected", {
        description: kind === "approve" ? `Ready to send to ${updated.customerName}. Stock has been reserved.` : "The customer won't receive this draft.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[var(--support)] via-[var(--inventory)] to-[var(--sales)]" aria-hidden />
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-fg">Quotation QUO-{shortId(quotation.id)}</h2>
            <Badge tone={quotation.status === "approved" ? "success" : quotation.status === "rejected" ? "danger" : "warning"} dot>
              {quotation.status === "pending" ? "Awaiting approval" : quotation.status === "approved" ? "Approved" : "Rejected"}
            </Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">For {quotation.customerName} · {quotation.customerEmail}</p>
        </div>
        <Link href={`/approvals?id=${quotation.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
          Open in Approval Center <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className={cn("mx-5 mt-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px]", shortage ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
        {shortage ? <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden /> : <Check className="mt-px h-4 w-4 shrink-0" aria-hidden />}
        <p>{summary}</p>
      </div>

      <div className="overflow-x-auto px-5 py-4">
        <table className="w-full min-w-[420px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-subtle">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Unit price</th>
              <th className="pb-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {quotation.items.map((item) => (
              <tr key={item.productId}>
                <td className="py-2.5 text-fg">
                  {item.name}
                  {!item.inStock && <Badge tone="danger" className="ml-2">Short</Badge>}
                </td>
                <td className="tabular py-2.5 text-right text-fg">{item.quantity}</td>
                <td className="tabular py-2.5 text-right text-muted">{formatCurrency(item.unitPrice)}</td>
                <td className="tabular py-2.5 text-right font-medium text-fg">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 w-full max-w-72 space-y-1.5 text-[13px]">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular text-fg">{formatCurrency(quotation.subtotal)}</dd></div>
          {quotation.discount > 0 && (
            <div className="flex justify-between"><dt className="text-muted">Volume discount</dt><dd className="tabular text-success">−{formatCurrency(quotation.discount)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-muted">GST (18%)</dt><dd className="tabular text-fg">{formatCurrency(quotation.tax)}</dd></div>
          <div className="flex items-baseline justify-between border-t border-border pt-2">
            <dt className="text-sm font-semibold text-fg">Total</dt>
            <dd className="tabular text-lg font-semibold text-fg">{formatCurrency(quotation.total)}</dd>
          </div>
        </dl>
      </div>

      {quotation.status === "pending" && (
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface-2/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          <p className="mr-auto hidden text-xs text-muted sm:block">Approving releases the quote and reserves stock.</p>
          <Button variant="secondary" onClick={() => decide("reject")} loading={busy === "reject"} disabled={!!busy}>Reject</Button>
          <Button onClick={() => decide("approve")} loading={busy === "approve"} disabled={!!busy}>
            {busy !== "approve" && <Check className="h-4 w-4" aria-hidden />} Approve quotation
          </Button>
        </div>
      )}
    </Card>
  );
}
