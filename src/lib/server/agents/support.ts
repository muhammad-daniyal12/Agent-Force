import { z } from "zod";
import type { Product } from "../contracts";

export const interpretationSchema = z
  .object({
    intent: z.enum(["quote", "purchase", "support", "other"]),
    items: z
      .array(
        z
          .object({
            productQuery: z.string().trim().min(1).max(200),
            quantity: z.number().int().min(1).max(1000),
          })
          .strict(),
      )
      .max(20),
    urgency: z.enum(["low", "normal", "high"]),
    sentiment: z.enum(["positive", "neutral", "negative"]),
  })
  .strict();
export type Interpretation = z.infer<typeof interpretationSchema>;

export function normalizeProduct(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\bmice\b/g, "mouse")
    .replace(
      /\b(keyboards|monitors|hubs|headsets|webcams|stands|cables|speakers|protectors|headphones)\b/g,
      (word) => word.slice(0, -1),
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const words: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
};
const numberPattern = `\\d+|${Object.keys(words).join("|")}`;

export function fallbackInterpret(
  request: string,
  catalog: Product[],
): Interpretation {
  const normalized = normalizeProduct(request);
  const support =
    /\b(refund|return|broken|complaint|cancel|tracking|delivery status)\b/i.test(
      request,
    );
  const buying =
    !support &&
    /\b(need|want|quote|quotation|price|buy|order|purchase|cost|looking for|how much)\b/i.test(
      request,
    );
  const intent: Interpretation["intent"] = support
    ? "support"
    : buying
      ? "quote"
      : "other";
  const items: Interpretation["items"] = [];
  if (buying) {
    const expression = new RegExp(
      `\\b(${numberPattern})\\s+(?:x\\s+|units?\\s+of\\s+|pieces?\\s+of\\s+)?([^,;.!?]+?)(?=\\s+(?:and|&)\\s+(?:${numberPattern})\\b|[,;.!?]|$)`,
      "gi",
    );
    let invalidQuantity = false;
    for (const match of request.matchAll(expression)) {
      const quantity = words[match[1].toLowerCase()] ?? Number(match[1]);
      const productQuery = match[2]
        .split(/\s+(?:for|please|my name|what|how much)\b/i)[0]
        .trim();
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 1000 ||
        items.length >= 20
      ) {
        invalidQuantity = true;
        break;
      }
      if (productQuery && productQuery.length <= 200)
        items.push({ productQuery, quantity });
    }
    if (invalidQuantity) items.length = 0;
    else if (!items.length) {
      // A price inquiry without quantities means one of each explicitly named item.
      // Do not invent a product or choose between ambiguous generic names.
      for (const product of catalog)
        if (
          normalized.includes(normalizeProduct(product.name)) ||
          normalized.includes(normalizeProduct(product.sku))
        )
          items.push({ productQuery: product.sku, quantity: 1 });
      if (items.length > 20) items.length = 0;
    }
  }
  return {
    intent,
    items,
    urgency: /\b(urgent|asap|today)\b/i.test(request) ? "high" : "normal",
    sentiment: /\b(angry|disappointed|broken|refund)\b/i.test(request)
      ? "negative"
      : "neutral",
  };
}
