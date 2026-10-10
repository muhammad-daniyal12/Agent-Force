"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Mail, MessageCircle, Plus, Settings2, Trash2, Truck, UserPlus } from "lucide-react";
import type { Product } from "@/types";
import { useBusiness, isValidPhone, toWhatsAppNumber } from "@/lib/business";
import {
  draftDealerOrders,
  newDealerId,
  purchaseOrderText,
  useDealers,
  useOrderedMarks,
  useSaveDealers,
  type Dealer,
  type DealerOrder,
} from "@/lib/dealers";
import { Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AgentAvatar } from "@/components/agent-meta";

/** Inventory Agent's restock suggestions: one draft purchase order per dealer. */
export function RestockPanel({ products }: { products: Product[] }) {
  const dealers = useDealers();
  const { marks, markOrdered } = useOrderedMarks();
  const [reviewing, setReviewing] = useState<DealerOrder | null>(null);
  const [managing, setManaging] = useState(false);

  const orders = draftDealerOrders(products, dealers, marks);
  const itemCount = orders.reduce((s, o) => s + o.items.length, 0);

  return (
    <>
      <Card className="animate-fade-up mb-6 overflow-hidden border-inventory/30">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center">
          <AgentAvatar type="inventory" size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">
              {itemCount > 0
                ? `Inventory Agent drafted ${orders.filter((o) => o.dealer).length || "no"} dealer order${orders.filter((o) => o.dealer).length === 1 ? "" : "s"} for ${itemCount} low-stock product${itemCount === 1 ? "" : "s"}`
                : "Stock is healthy. No dealer orders needed"}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              Reorders automatically when a product reaches its “Low at” level (10 pieces by default). You review and send each order.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setManaging(true)} className="shrink-0">
            <Settings2 className="h-4 w-4" aria-hidden /> Dealers ({dealers.length})
          </Button>
        </div>

        {orders.length > 0 && (
          <ul className="stagger divide-y divide-border">
            {orders.map((order) => (
              <li key={order.dealer?.id ?? "none"} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${order.dealer ? "bg-inventory-soft text-inventory" : "bg-surface-2 text-muted"}`}>
                    <Truck className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">
                      {order.dealer ? order.dealer.name : "No dealer assigned"}
                      {order.dealer?.phone && <span className="ml-2 text-xs font-normal text-muted">{order.dealer.phone}</span>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {order.items.map(({ product, qty }) => (
                        <Badge key={product.id} tone={product.stock === 0 ? "danger" : "warning"}>
                          {product.name} · {product.stock} left → order {qty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {order.dealer ? (
                  <Button onClick={() => setReviewing(order)} className="shrink-0">
                    <MessageCircle className="h-4 w-4" aria-hidden /> Review &amp; send order
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setManaging(true)} className="shrink-0">
                    <UserPlus className="h-4 w-4" aria-hidden /> Add a dealer for these
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <OrderDialog
        order={reviewing}
        onClose={() => setReviewing(null)}
        onOrdered={(ids, dealerName) => {
          markOrdered(ids);
          toast.success("Marked as ordered", { description: `${dealerName} · ${ids.length} product${ids.length > 1 ? "s" : ""}. Hidden for 3 days or until restocked.` });
          setReviewing(null);
        }}
      />
      <DealersDialog open={managing} onClose={() => setManaging(false)} />
    </>
  );
}

function OrderDialog({ order, onClose, onOrdered }: { order: DealerOrder | null; onClose: () => void; onOrdered: (ids: string[], dealerName: string) => void }) {
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      {order?.dealer && <OrderDialogBody key={order.dealer.id} order={order} dealer={order.dealer} onOrdered={onOrdered} />}
    </Dialog>
  );
}

function OrderDialogBody({ order, dealer, onOrdered }: { order: DealerOrder; dealer: Dealer; onOrdered: (ids: string[], dealerName: string) => void }) {
  const biz = useBusiness();
  const [text, setText] = useState(() => purchaseOrderText(order, biz));
  const wa = toWhatsAppNumber(dealer.phone);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Order copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <DialogContent title={`Order for ${dealer.name}`} description={`Drafted by the Inventory Agent · ${order.items.length} product${order.items.length > 1 ? "s" : ""}. Edit quantities before sending.`} className="max-w-xl">
      <Textarea aria-label="Dealer order" value={text} onChange={(e) => setText(e.target.value)} rows={12} className="font-mono text-[12.5px] leading-relaxed" />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild className="bg-[#25D366] text-white hover:opacity-90">
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp {dealer.name.split(" ")[0]}
          </a>
        </Button>
        {dealer.email && (
          <Button asChild variant="secondary">
            <a href={`mailto:${dealer.email}?subject=${encodeURIComponent(`Purchase order from ${biz.name}`)}&body=${encodeURIComponent(text)}`}>
              <Mail className="h-4 w-4" aria-hidden /> Email
            </a>
          </Button>
        )}
        <Button variant="secondary" onClick={copy}>
          <Copy className="h-4 w-4" aria-hidden /> Copy
        </Button>
        <Button variant="ghost" className="ml-auto" onClick={() => onOrdered(order.items.map((i) => i.product.id), dealer.name)}>
          <Check className="h-4 w-4" aria-hidden /> Mark as ordered
        </Button>
      </div>
    </DialogContent>
  );
}

type DraftDealer = Dealer & { categoriesText: string };

function DealersDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dealers = useDealers();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <DealersEditor key={dealers.map((d) => d.id).join(",")} initial={dealers} onClose={onClose} />}
    </Dialog>
  );
}

function DealersEditor({ initial, onClose }: { initial: Dealer[]; onClose: () => void }) {
  const save = useSaveDealers();
  const [rows, setRows] = useState<DraftDealer[]>(() => initial.map((d) => ({ ...d, categoriesText: d.categories.join(", ") })));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (id: string, patch: Partial<DraftDealer>) => setRows((r) => r.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  function submit() {
    const next: Record<string, string> = {};
    for (const d of rows) {
      if (!d.name.trim()) next[d.id] = "Dealer name is required";
      else if (!d.phone.trim() || !isValidPhone(d.phone)) next[d.id] = "Enter a valid WhatsApp number, e.g. 0300 1234567";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    save(
      rows.map(({ categoriesText, ...d }) => ({
        ...d,
        name: d.name.trim(),
        phone: d.phone.trim(),
        email: d.email.trim(),
        categories: categoriesText.split(",").map((c) => c.trim()).filter(Boolean),
      })),
    );
    toast.success("Dealers saved");
    onClose();
  }

  return (
    <DialogContent title="Dealers" description="Who supplies what. Low-stock products are matched to a dealer by category; leave categories empty for a dealer who supplies everything." className="max-w-2xl">
      <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {rows.length === 0 && <p className="rounded-lg bg-surface-2 px-4 py-6 text-center text-sm text-muted">No dealers yet. Add your first supplier below.</p>}
        {rows.map((d) => (
          <div key={d.id} className="rounded-xl border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Dealer name" htmlFor={`${d.id}-name`}>
                <Input id={`${d.id}-name`} value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} placeholder="Ali Traders" />
              </Field>
              <Field label="WhatsApp number" htmlFor={`${d.id}-phone`}>
                <Input id={`${d.id}-phone`} inputMode="tel" value={d.phone} onChange={(e) => update(d.id, { phone: e.target.value })} placeholder="0300 1234567" />
              </Field>
              <Field label="Email (optional)" htmlFor={`${d.id}-email`}>
                <Input id={`${d.id}-email`} type="email" value={d.email} onChange={(e) => update(d.id, { email: e.target.value })} placeholder="orders@dealer.pk" />
              </Field>
              <Field label="Supplies categories" htmlFor={`${d.id}-cats`} hint="Comma separated, e.g. Peripherals, Cables">
                <Input id={`${d.id}-cats`} value={d.categoriesText} onChange={(e) => update(d.id, { categoriesText: e.target.value })} placeholder="Everything" />
              </Field>
            </div>
            <div className="mt-3 flex items-center justify-between">
              {errors[d.id] ? <p className="text-xs text-danger">{errors[d.id]}</p> : <span />}
              <Button variant="ghost" size="sm" onClick={() => setRows((r) => r.filter((x) => x.id !== d.id))} className="hover:text-danger">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={() => setRows((r) => [...r, { id: newDealerId(), name: "", phone: "", email: "", categories: [], categoriesText: "" }])}>
          <Plus className="h-4 w-4" aria-hidden /> Add dealer
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save dealers</Button>
        </div>
      </div>
    </DialogContent>
  );
}
