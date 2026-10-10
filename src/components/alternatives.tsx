"use client";

import { ArrowRight, Lightbulb } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAsync } from "@/lib/use-async";
import { formatCurrency } from "@/lib/utils";
import type { Product, Quotation } from "@/types";

/** For each short item: in-stock products from the same category, closest in price first. */
function findAlternatives(quotation: Quotation, catalog: Product[]) {
  return quotation.items
    .filter((i) => !i.inStock)
    .map((item) => {
      const original = catalog.find((p) => p.id === item.productId);
      const options = original
        ? catalog
            .filter((p) => p.id !== original.id && p.category === original.category && p.stock >= item.quantity)
            .sort((a, b) => Math.abs(a.price - item.unitPrice) - Math.abs(b.price - item.unitPrice))
            .slice(0, 2)
        : [];
      return { item, available: original?.stock ?? 0, options };
    });
}

/** Inventory Agent's suggestions shown next to a quotation that has stock shortages. */
export function AlternativeSuggestions({ quotation }: { quotation: Quotation }) {
  const short = quotation.items.some((i) => !i.inStock);
  const { data: catalog } = useAsync(() => (short ? api.products() : Promise.resolve([] as Product[])), [quotation.id]);
  if (!short || !catalog) return null;
  const suggestions = findAlternatives(quotation, catalog);

  return (
    <div className="rounded-xl border border-inventory/30 bg-inventory-soft/50 p-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Lightbulb className="h-4 w-4 text-inventory" aria-hidden /> Inventory Agent suggests
      </p>
      <ul className="mt-3 space-y-3">
        {suggestions.map(({ item, available, options }) => (
          <li key={item.productId} className="text-[13px]">
            <p className="text-fg">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted"> · {item.quantity} requested, {available} in stock</span>
            </p>
            {options.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {options.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted">
                    <ArrowRight className="h-3.5 w-3.5 text-inventory" aria-hidden />
                    <span>Offer</span>
                    <span className="font-medium text-fg">{p.name}</span>
                    <span>· {formatCurrency(p.price)} each · {p.stock} in stock</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 flex items-center gap-2 text-muted">
                <ArrowRight className="h-3.5 w-3.5 text-inventory" aria-hidden />
                No in-stock alternative. {available > 0 ? `Offer ${available} now and the rest within 5 working days.` : "Quote a 5–7 day delivery and restock."}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
