"use client";

import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { dealerFor, isLow, type Dealer } from "@/lib/dealers";
import type { Quotation } from "@/types";

/**
 * After an approval reduces stock, tell the owner which quoted products are now low
 * and which dealer the Inventory Agent drafted an order for.
 */
export async function alertLowStockAfterApproval(quotation: Quotation, dealers: Dealer[], openInventory: () => void) {
  let catalog;
  try {
    catalog = await api.products();
  } catch {
    return; // The approval already succeeded; the alert is a bonus.
  }
  const quotedIds = new Set(quotation.items.map((i) => i.productId));
  const low = catalog.filter((p) => quotedIds.has(p.id) && isLow(p));
  if (low.length === 0) return;

  const first = low[0];
  const dealer = dealerFor(first, dealers);
  const others = low.length > 1 ? ` and ${low.length - 1} more` : "";
  toast.warning(`Inventory Agent: ${first.name} is down to ${first.stock}${others}`, {
    description: dealer ? `Order drafted for ${dealer.name}. Review it before sending.` : "No dealer assigned yet. Add one to send a reorder.",
    duration: 10000,
    action: { label: dealer ? "Review order" : "Add dealer", onClick: openInventory },
  });
}
