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
  const discount = Math.round(
    subtotal * (subtotal > 200000 ? 0.1 : subtotal > 50000 ? 0.05 : 0),
  );
  const tax = Math.round((subtotal - discount) * taxRate);
  const total = subtotal - discount + tax;
  if (
    ![subtotal, discount, tax, total].every(Number.isSafeInteger) ||
    total > 100000000000000
  )
    throw new ApiError(422, "Requested amount is too large.");
  return {
    items: lines,
    subtotal: subtotal / 100,
    discount: discount / 100,
    tax: tax / 100,
    total: total / 100,
  };
}
