// Pricing rules for demo data. Must match the backend's createQuotation tool.
// All amounts are PKR, rounded to whole rupees.

export const GST_RATE = 0.18;

export function discountRateFor(subtotal: number) {
  if (subtotal > 500_000) return 0.1;
  if (subtotal > 150_000) return 0.05;
  return 0;
}

export function priceQuote(lineTotals: number[]) {
  const subtotal = Math.round(lineTotals.reduce((s, t) => s + t, 0));
  const discountRate = discountRateFor(subtotal);
  const discount = Math.round(subtotal * discountRate);
  const tax = Math.round((subtotal - discount) * GST_RATE);
  return { subtotal, discountRate, discount, tax, total: subtotal - discount + tax };
}
