import { z } from "zod";
import { ApiError } from "./errors";

export const resourceId = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/, "Invalid record ID.");
const money = z
  .number()
  .finite()
  .min(0)
  .max(1000000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
    "Use at most two decimal places.",
  );
export const productInput = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(64)
      .regex(/^[A-Z0-9_-]+$/),
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(100),
    price: money,
    stock: z.number().int().min(0).max(1000000),
    lowStockThreshold: z.number().int().min(0).max(1000000),
  })
  .strict();
export const productPatch = productInput
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one editable field.",
  );
export const operationInput = z
  .object({
    customerName: z.string().trim().min(1).max(120),
    customerEmail: z.email().max(254),
    request: z.string().trim().min(1).max(2000),
  })
  .strict();
export const decisionInput = z
  .object({ note: z.string().trim().max(1000).optional() })
  .strict();
export const quotationStatus = z.enum(["pending", "approved", "rejected"]);
export const quotationItem = z
  .object({
    productId: resourceId,
    name: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(1000),
    unitPrice: money,
    total: z.number().finite().nonnegative(),
    inStock: z.boolean(),
  })
  .strict();
export const quotationItems = z.array(quotationItem).min(1).max(20);

export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new ApiError(415, "Use Content-Type: application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 32768) {
        await reader.cancel();
        throw new ApiError(413, "Request body exceeds 32 KiB.");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Malformed JSON body.");
  }
  return schema.parse(body);
}

export function queryParams(
  request: Request,
  allowed: string[],
): URLSearchParams {
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (!allowed.includes(key) || query.getAll(key).length !== 1)
      throw new ApiError(400, "Unsupported or repeated query parameter.");
  }
  return query;
}
