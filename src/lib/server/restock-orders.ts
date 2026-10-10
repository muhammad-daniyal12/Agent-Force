import "server-only";
import { Query } from "node-appwrite";
import { z } from "zod";
import { ApiError } from "./errors";
import { dealerDto } from "./dealers";
import { productDto } from "./mappers";
import type { BusinessStore, BusinessRow } from "./store";
import { resourceId } from "./validation";

export const markSentInput = z
  .object({
    dealerId: resourceId,
    productIds: z
      .array(resourceId)
      .min(1)
      .max(50)
      .refine((values) => new Set(values).size === values.length, "Duplicate product ID."),
  })
  .strict();

const orderItem = z.object({
  productId: resourceId,
  quantity: z.number().int().min(1).max(4_000_000),
}).strict();
const orderItems = z.array(orderItem).min(1).max(50);
const orderStatus = z.enum(["draft", "sent"]);

export interface RestockOrder {
  id: string;
  dealerId: string;
  items: Array<{ productId: string; quantity: number }>;
  status: "draft" | "sent";
  sentAt?: string;
  createdAt: string;
}

function orderDto(row: BusinessRow): RestockOrder {
  let items: unknown;
  try {
    items = JSON.parse(String(row.itemsJson));
  } catch {
    throw new ApiError(503, "Stored restock order items are invalid.");
  }
  const data = z.object({
    dealerId: resourceId,
    items: orderItems,
    status: orderStatus,
    sentAt: z.iso.datetime({ offset: true }).optional(),
  }).safeParse({
    dealerId: row.dealerId,
    items,
    status: row.status,
    ...(row.sentAt != null ? { sentAt: row.sentAt } : {}),
  });
  if (!data.success) throw new ApiError(503, "Stored restock order is invalid.");
  return { id: row.$id, ...data.data, createdAt: row.$createdAt };
}

export async function markRestockSent(
  store: BusinessStore,
  input: z.infer<typeof markSentInput>,
): Promise<{ ok: true }> {
  await store.transaction(async (transactionId) => {
    const dealer = dealerDto(await store.get("dealers", input.dealerId, transactionId));
    const items: Array<{ productId: string; quantity: number }> = [];
    for (const productId of input.productIds) {
      const product = productDto(await store.get("products", productId, transactionId));
      if (product.stock > product.lowStockThreshold)
        throw new ApiError(422, "Only low-stock products can be marked for reorder.");
      const quantity = Math.max(
        5,
        Math.ceil((product.lowStockThreshold * 4 - product.stock) / 5) * 5,
      );
      items.push({ productId, quantity });
    }
    const record = await store.create(
      "restockOrders",
      {
        dealerId: dealer.id,
        itemsJson: JSON.stringify(items),
        status: "sent",
        sentAt: new Date().toISOString(),
      },
      transactionId,
    );
    await store.activity(
      "Admin",
      "Admin sent restock order to " + dealer.name,
      record.$id,
      transactionId,
    );
  });
  // Records the owner's action; deliberately does not contact a supplier.
  return { ok: true };
}

export async function listRestockOrders(
  store: BusinessStore,
  status?: "draft" | "sent",
  since?: string,
): Promise<RestockOrder[]> {
  const threshold = since ? Date.parse(since) : undefined;
  const rows = await store.list("restockOrders", [Query.orderDesc("$createdAt"), Query.orderDesc("$id")]);
  return rows
    .map(orderDto)
    .filter((order) => !status || order.status === status)
    .filter((order) =>
      threshold === undefined ||
      (order.sentAt !== undefined && Date.parse(order.sentAt) >= threshold),
    );
}

export const restockStatus = orderStatus;
export const restockSince = z.iso.datetime({ offset: true });
