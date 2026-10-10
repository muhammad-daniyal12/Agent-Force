import type { Product } from "../contracts";
import { normalizeProduct } from "./support";

const ignored = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "my",
  "office",
  "please",
  "some",
  "units",
  "pieces",
]);
function tokens(value: string) {
  return normalizeProduct(value)
    .split(" ")
    .filter((word) => word && !ignored.has(word));
}

export function findProduct(
  productQuery: string,
  products: Product[],
): Product | null {
  const query = normalizeProduct(productQuery);
  if (!query) return null;
  const queryTokens = tokens(productQuery);
  const scored = products
    .map((product) => {
      const name = normalizeProduct(product.name);
      const sku = normalizeProduct(product.sku);
      if (sku === query || name === query) return { product, score: 1 };
      const nameTokens = tokens(product.name);
      const common = queryTokens.filter((token) =>
        nameTokens.includes(token),
      ).length;
      const score = common
        ? (common / queryTokens.length + common / nameTokens.length) / 2
        : 0;
      return { product, score };
    })
    .filter((match) => match.score >= 0.65)
    .sort((a, b) => b.score - a.score);
  if (
    !scored.length ||
    (scored.length > 1 && scored[0].score - scored[1].score < 0.1)
  )
    return null;
  return scored[0].product;
}

export function checkStock(
  productQuery: string,
  quantity: number,
  products: Product[],
) {
  const product = findProduct(productQuery, products);
  return {
    product,
    available: product?.stock ?? 0,
    inStock: Boolean(product && product.stock >= quantity),
  };
}
