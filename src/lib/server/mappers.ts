import { z } from "zod";
import type { ActivityLog, Product, Quotation } from "./contracts";
import { ApiError } from "./errors";
import type { BusinessRow } from "./store";
import { productInput, quotationItems, quotationStatus } from "./validation";

function stored<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      503,
      "A stored business record is invalid. Check the database schema.",
    );
  return result.data;
}

export function productDto(row: BusinessRow): Product {
  const value = stored(productInput, {
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: row.price,
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
  });
  return { id: row.$id, ...value, updatedAt: row.$updatedAt };
}

export function quoteDto(row: BusinessRow): Quotation {
  let items: unknown;
  try {
    items = JSON.parse(String(row.itemsJson));
  } catch {
    throw new ApiError(503, "Stored quotation items are invalid.");
  }
  const value = stored(
    z.object({
      customerName: z.string().min(1).max(120),
      customerEmail: z.email().max(254),
      request: z.string().min(1).max(2000),
      items: quotationItems,
      subtotal: z.number().finite().nonnegative(),
      discount: z.number().finite().nonnegative(),
      tax: z.number().finite().nonnegative(),
      total: z.number().finite().nonnegative(),
      status: quotationStatus,
      reviewerNote: z.string().max(1000).optional(),
    }),
    {
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      request: row.request,
      items,
      subtotal: row.subtotal,
      discount: row.discount,
      tax: row.tax,
      total: row.total,
      status: row.status,
      ...(row.reviewerNote != null ? { reviewerNote: row.reviewerNote } : {}),
    },
  );
  return { id: row.$id, ...value, createdAt: row.$createdAt };
}

export function activityDto(row: BusinessRow): ActivityLog {
  const value = stored(
    z.object({
      actor: z.string().max(64),
      action: z.string().max(200),
      target: z.string().max(200),
    }),
    row,
  );
  return { id: row.$id, ...value, createdAt: row.$createdAt };
}
