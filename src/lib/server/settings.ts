import "server-only";
import { z } from "zod";
import { ApiError } from "./errors";
import type { BusinessStore, BusinessRow } from "./store";

const optionalText = (limit: number) => z.string().trim().max(limit).optional();
const phone = z.string().trim().max(20).refine(
  (value) =>
    value === "" ||
    (/^\+?[0-9 ]+$/.test(value) &&
      /^\d{10,15}$/.test(value.replace(/\D/g, ""))),
  "Phone must contain 10 to 15 digits, optionally with spaces or leading +.",
).optional();

export const settingsInput = z.object({
  name: z.string().trim().min(1).max(120),
  city: optionalText(80),
  phone,
  email: z.union([z.literal(""), z.email().max(254)]).optional(),
}).strict();

export type BusinessSettings = {
  name: string;
  city: string;
  phone: string;
  email: string;
};

function dto(row: BusinessRow): BusinessSettings {
  const check = settingsInput.safeParse({
    name: row.name,
    city: row.city,
    phone: row.phone,
    email: row.email,
  });
  if (!check.success)
    throw new ApiError(503, "Stored business settings are invalid.");
  return {
    name: check.data.name,
    city: check.data.city ?? "",
    phone: check.data.phone ?? "",
    email: check.data.email ?? "",
  };
}

export async function readSettings(
  store: BusinessStore,
  accountName: string,
): Promise<BusinessSettings> {
  try {
    return dto(await store.get("settings", store.ownerId));
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
    return { name: accountName.trim() || "My Business", city: "", phone: "", email: "" };
  }
}

export async function writeSettings(
  store: BusinessStore,
  input: z.infer<typeof settingsInput>,
): Promise<BusinessSettings> {
  const data: BusinessSettings = {
    name: input.name,
    city: input.city ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
  };
  await store.transaction(async (transactionId) => {
    try {
      await store.get("settings", store.ownerId, transactionId);
      await store.update("settings", store.ownerId, data, transactionId);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
      // Owner's stable Appwrite account ID prevents duplicate settings rows.
      await store.create("settings", data, transactionId, store.ownerId);
    }
    await store.activity("Admin", "Updated business settings", store.ownerId, transactionId);
  });
  return data;
}
