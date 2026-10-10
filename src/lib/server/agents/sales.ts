import type { Product, QuotationItem } from "../contracts";
import { ApiError } from "../errors";

export function createQuotation(
  items: { product: Product; quantity: number }[],
  taxRate: number,
) {
  const lines: QuotationItem[] = items.map(({ product, quantity }) => {
    const minor = Math.round(product.price * 100);
    const total = minor * quantity;
    if (!Number.isSafeInteger(total))
      throw new ApiError(422, "Requested amount is too large.");
    return {
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: minor / 100,
      total: total / 100,
      inStock: product.stock >= quantity,
    };
  });
  const subtotal = lines.reduce(
    (sum, line) => sum + Math.round(line.total * 100),
    0,
  );
  // UI displays PKR amounts in whole rupees. Apply volume thresholds to
  // major currency units, not the cent-based storage arithmetic above.
  const subtotalRupees = Math.round(subtotal / 100);
  const discount = Math.round(
    subtotalRupees *
      (subtotalRupees > 500_000 ? 0.1 : subtotalRupees > 150_000 ? 0.05 : 0),
  );
  const tax = Math.round((subtotalRupees - discount) * taxRate);
  const total = subtotalRupees - discount + tax;
  if (
    ![subtotal, discount, tax, total].every(Number.isSafeInteger) ||
    total > 100000000000000
  )
    throw new ApiError(422, "Requested amount is too large.");
  return {
    items: lines,
    subtotal: subtotalRupees,
    discount,
    tax,
    total,
  };
}
