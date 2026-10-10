"use client";

// Dealers (suppliers) and the Inventory Agent's restock logic. Stored per owner in this
// browser until the backend has a dealers table; see docs in the feature PR.
import { useCallback, useSyncExternalStore } from "react";
import { useSessionUser } from "@/components/session";
import type { BusinessProfile } from "@/lib/business";
import type { Product } from "@/types";

export interface Dealer {
  id: string;
  name: string;
  phone: string;
  email: string;
  /** Product categories this dealer supplies, e.g. ["Peripherals", "Cables"]. Empty = everything. */
  categories: string[];
}

export interface RestockItem {
  product: Product;
  qty: number;
}

export interface DealerOrder {
  dealer: Dealer | null; // null = no dealer assigned for these products yet
  items: RestockItem[];
}

const CHANGED = "agentforce:dealers-changed";
const dealersKey = (userId: string) => `agentforce.dealers.${userId}`;
const orderedKey = (userId: string) => `agentforce.dealer-ordered.${userId}`;
/** An "ordered" mark hides the item for this long, or until stock is back above its low level. */
const ORDERED_HIDE_MS = 3 * 24 * 60 * 60 * 1000;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: changes last until reload.
  }
  window.dispatchEvent(new Event(CHANGED));
};

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Demo dealers so the feature is usable straight away; owners edit or remove them.
const DEMO_DEALERS: Dealer[] = [
  { id: "dlr_ali", name: "Ali Traders", phone: "0300 1112233", email: "orders@alitraders.pk", categories: ["Peripherals", "Cables", "Accessories"] },
  { id: "dlr_hafeez", name: "Hafeez Centre Wholesale", phone: "0321 4445566", email: "sales@hafeezwholesale.pk", categories: ["Displays", "Audio", "Video", "Storage", "Furniture"] },
];

/** Live list of the owner's dealers. Raw string snapshot keeps useSyncExternalStore stable. */
export function useDealers(): Dealer[] {
  const user = useSessionUser();
  const raw = useSyncExternalStore(
    subscribe,
    () => (user ? localStorage.getItem(dealersKey(user.id)) : null),
    () => null,
  );
  if (!user) return [];
  if (raw === null) return DEMO_DEALERS;
  try {
    return JSON.parse(raw) as Dealer[];
  } catch {
    return DEMO_DEALERS;
  }
}

export function useSaveDealers() {
  const user = useSessionUser();
  return useCallback((dealers: Dealer[]) => user && write(dealersKey(user.id), dealers), [user]);
}

export function useOrderedMarks() {
  const user = useSessionUser();
  const raw = useSyncExternalStore(
    subscribe,
    () => (user ? localStorage.getItem(orderedKey(user.id)) : null),
    () => null,
  );
  const marks: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  const markOrdered = useCallback(
    (productIds: string[]) => {
      if (!user) return;
      const next = { ...read<Record<string, number>>(orderedKey(user.id), {}) };
      for (const id of productIds) next[id] = Date.now();
      write(orderedKey(user.id), next);
    },
    [user],
  );
  return { marks, markOrdered };
}

/** Reorder enough to reach four times the low-stock level, rounded up to a multiple of 5. */
export const reorderQty = (p: Product) => Math.max(5, Math.ceil((p.lowStockThreshold * 4 - p.stock) / 5) * 5);

export const isLow = (p: Product) => p.stock <= p.lowStockThreshold;

export function dealerFor(product: Product, dealers: Dealer[]): Dealer | null {
  const cat = product.category.trim().toLowerCase();
  return (
    dealers.find((d) => d.categories.some((c) => c.trim().toLowerCase() === cat)) ??
    dealers.find((d) => d.categories.length === 0) ??
    null
  );
}

/** Low-stock products not recently ordered, grouped into one draft order per dealer. */
export function draftDealerOrders(products: Product[], dealers: Dealer[], ordered: Record<string, number>, now = Date.now()): DealerOrder[] {
  const groups = new Map<string, DealerOrder>();
  for (const product of products.filter(isLow).sort((a, b) => a.stock - b.stock)) {
    const orderedAt = ordered[product.id];
    if (orderedAt && now - orderedAt < ORDERED_HIDE_MS) continue;
    const dealer = dealerFor(product, dealers);
    const key = dealer?.id ?? "__none";
    const group = groups.get(key) ?? { dealer, items: [] };
    group.items.push({ product, qty: reorderQty(product) });
    groups.set(key, group);
  }
  // Orders that can be sent first; unassigned products last.
  return [...groups.values()].sort((a, b) => (a.dealer ? 0 : 1) - (b.dealer ? 0 : 1));
}

export function purchaseOrderText(order: DealerOrder, biz: BusinessProfile) {
  const date = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
  return [
    order.dealer ? `Assalam o Alaikum ${order.dealer.name},` : "Assalam o Alaikum,",
    "",
    `Purchase order from ${[biz.name, biz.city].filter(Boolean).join(", ")} (${date}). Please supply:`,
    "",
    ...order.items.map(({ product, qty }) => `• ${product.name} (${product.sku}) × ${qty}`),
    "",
    "Kindly confirm availability, price and delivery date.",
    "",
    "JazakAllah,",
    biz.name,
    ...(biz.phone ? [biz.phone] : []),
  ].join("\n");
}

export const newDealerId = () => `dlr_${Math.random().toString(36).slice(2, 8)}`;
