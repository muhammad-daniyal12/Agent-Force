import "server-only";
import { z } from "zod";
import type { BusinessStore, BusinessRow } from "./store";
import { ApiError } from "./errors";
import { resourceId } from "./validation";

const phone = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine(
    (value) =>
      /^\+?[0-9\s().-]+$/.test(value) &&
      /^\d{10,15}$/.test(value.replace(/\D/g, "")),
    "Phone must contain 10 to 15 digits.",
  )
  .transform((value) => value.replace(/\D/g, ""));

const categories = z
  .array(z.string().trim().min(1).max(100))
  .max(20)
  .refine(
    (values) => new Set(values.map((v) => v.toLowerCase())).size === values.length,
    "Dealer categories must be unique.",
  );

export const dealerInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    phone,
    email: z.union([z.literal(""), z.email().max(254)]).optional(),
    categories: categories.optional(),
  })
  .strict();

export const dealerPatch = dealerInput
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide an editable field.");

const storedDealer = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().regex(/^\d{10,15}$/),
  email: z.union([z.literal(""), z.email().max(254)]),
  categories,
});

export interface Dealer {
  id: string;
  name: string;
  phone: string;
  email: string;
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

export function dealerDto(row: BusinessRow): Dealer {
  const parsed = storedDealer.safeParse({
    name: row.name,
    phone: row.phone,
    email: row.email ?? "",
    categories: row.categories ?? [],
  });
  if (!parsed.success) throw new ApiError(503, "Stored dealer record is invalid.");
  return {
    id: row.$id,
    ...parsed.data,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}

export async function listDealers(store: BusinessStore): Promise<Dealer[]> {
  return (await store.list("dealers")).map(dealerDto).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createDealer(
  store: BusinessStore,
  input: z.infer<typeof dealerInput>,
): Promise<Dealer> {
  const created = await store.transaction(async (transactionId) => {
    const row = await store.create(
      "dealers",
      {
        name: input.name,
        phone: input.phone,
        email: input.email ?? "",
        categories: input.categories ?? [],
      },
      transactionId,
    );
    await store.activity("Admin", "Added dealer", row.$id, transactionId);
    return row;
  });
  return dealerDto(created);
}

export async function updateDealer(
  store: BusinessStore,
  id: string,
  input: z.infer<typeof dealerPatch>,
): Promise<Dealer> {
  const updated = await store.transaction(async (transactionId) => {
    const row = await store.update("dealers", id, input, transactionId);
    await store.activity("Admin", "Updated dealer", id, transactionId);
    return row;
  });
  return dealerDto(updated);
}

export async function deleteDealer(store: BusinessStore, id: string): Promise<{ ok: true }> {
  await store.transaction(async (transactionId) => {
    await store.remove("dealers", id, transactionId);
    await store.activity("Admin", "Deleted dealer", id, transactionId);
  });
  return { ok: true };
}

export const dealerId = resourceId;
