import "server-only";
import { createHash } from "node:crypto";
import { AppwriteException, TablesDB } from "node-appwrite";
import { getConfig } from "../appwrite/config";
import { ApiError } from "./errors";

// Persistent buckets enforce the same limits across concurrent Sites instances.
// No caller can read this internal table; scripts prune expired buckets.
export async function rateLimit(db: TablesDB, identity: string, limit: number) {
  const config = getConfig();
  const window = Math.floor(Date.now() / 60000);
  const rowId = createHash("sha256")
    .update(`${identity}:${window}`)
    .digest("hex")
    .slice(0, 32);
  const args = {
    databaseId: config.databaseId,
    tableId: config.rateLimits,
    rowId,
  };
  try {
    await db.createRow({
      ...args,
      data: {
        count: 1,
        expires_at: new Date((window + 2) * 60000).toISOString(),
      },
      permissions: [],
    });
    return;
  } catch (error) {
    if (!(error instanceof AppwriteException) || error.code !== 409)
      throw error;
  }
  try {
    await db.incrementRowColumn({
      ...args,
      column: "count",
      value: 1,
      max: limit,
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 400)
      throw new ApiError(
        429,
        "Too many requests. Try again shortly.",
        Math.max(1, 60 - (Math.floor(Date.now() / 1000) % 60)),
      );
    throw error;
  }
}
