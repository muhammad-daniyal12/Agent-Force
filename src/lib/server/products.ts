import "server-only";
import type { z } from "zod";
import { productDto } from "./mappers";
import type { BusinessStore } from "./store";
import { productInput, productPatch } from "./validation";

export async function listProducts(store: BusinessStore, q = "") {
  const rows = await store.list("products");
  const needle = q.trim().toLocaleLowerCase();
  return rows
    .map(productDto)
    .filter(
      (product) =>
        !needle ||
        [product.name, product.sku, product.category].some((value) =>
          value.toLocaleLowerCase().includes(needle),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createProduct(
  store: BusinessStore,
  input: z.infer<typeof productInput>,
) {
  return store.transaction(async (transactionId) => {
    const row = await store.create("products", input, transactionId);
    await store.activity("Admin", "Created product", row.$id, transactionId);
    return productDto(row);
  });
}

export async function updateProduct(
  store: BusinessStore,
  id: string,
  input: z.infer<typeof productPatch>,
) {
  await store.transaction(async (transactionId) => {
    await store.update("products", id, input, transactionId);
    await store.activity("Admin", "Updated product", id, transactionId);
  });
  return productDto(await store.get("products", id));
}

export async function deleteProduct(store: BusinessStore, id: string) {
  await store.transaction(async (transactionId) => {
    await store.remove("products", id, transactionId);
    await store.activity("Admin", "Deleted product", id, transactionId);
  });
  return { ok: true as const };
}
