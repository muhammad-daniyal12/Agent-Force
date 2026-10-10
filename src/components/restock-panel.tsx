"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Copy, MessageCircle } from "lucide-react";
import type { Product } from "@/types";
import { BUSINESS, whatsappLink } from "@/lib/quotation-docs";
import { formatCurrency } from "@/lib/utils";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AgentAvatar } from "@/components/agent-meta";

/** Reorder enough to reach four times the low-stock threshold, rounded up to a multiple of 5. */
const reorderQty = (p: Product) => Math.max(5, Math.ceil((p.lowStockThreshold * 4 - p.stock) / 5) * 5);

function purchaseOrder(items: { product: Product; qty: number }[]) {
  const date = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
  return [
    `Purchase order from ${BUSINESS.name}, ${BUSINESS.city}`,
    `Date: ${date}`,
    "",
    "Please supply the following items:",
    ...items.map(({ product, qty }) => `• ${product.sku}: ${product.name} × ${qty}`),
    "",
    "Kindly confirm availability, price and delivery date.",
    "",
    `${BUSINESS.name}`,
    `${BUSINESS.phone} · ${BUSINESS.email}`,
  ].join("\n");
}

export function RestockPanel({ products }: { products: Product[] }) {
  const items = useMemo(
    () =>
      products
        .filter((p) => p.stock <= p.lowStockThreshold)
        .sort((a, b) => a.stock - b.stock)
        .map((product) => ({ product, qty: reorderQty(product) })),
    [products],
  );
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (items.length === 0) return null;
  const retailValue = items.reduce((s, { product, qty }) => s + product.price * qty, 0);

  function openDraft() {
    setText(purchaseOrder(items));
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Purchase order copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <>
      <Card className="animate-fade-up mb-6 overflow-hidden border-inventory/30">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <AgentAvatar type="inventory" size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">
              Inventory Agent suggests restocking {items.length} product{items.length > 1 ? "s" : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {items.map(({ product, qty }) => (
                <Badge key={product.id} tone={product.stock === 0 ? "danger" : "warning"}>
                  {product.name} · {product.stock} left → order {qty}
                </Badge>
              ))}
            </div>
          </div>
          <Button onClick={openDraft} className="shrink-0">
            <ClipboardList className="h-4 w-4" aria-hidden /> Draft purchase order
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Purchase order draft"
          description={`Prepared by the Inventory Agent · ${items.length} item${items.length > 1 ? "s" : ""} · about ${formatCurrency(retailValue)} at retail price. Review before sending to your supplier.`}
        >
          <Textarea aria-label="Purchase order" value={text} onChange={(e) => setText(e.target.value)} rows={12} className="font-mono text-[12.5px] leading-relaxed" />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={copy}>
              <Copy className="h-4 w-4" aria-hidden /> Copy
            </Button>
            <Button asChild className="bg-[#25D366] text-white hover:opacity-90">
              <a href={whatsappLink(text)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" aria-hidden /> Send to supplier
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
