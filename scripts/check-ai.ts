import { existsSync } from "node:fs";
import { Client, Query, TablesDB } from "node-appwrite";
import { getConfig } from "../src/lib/appwrite/config";
import { interpretRequest } from "../src/lib/server/llm";
import { checkStock } from "../src/lib/server/agents/inventory";
import type { Product } from "../src/lib/server/contracts";
import { resourceId } from "../src/lib/server/validation";

// Operator-only read check. No database writes, sessions, or approvals.
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const config = getConfig();
  const ownerId = resourceId.parse(process.env.SEED_OWNER_USER_ID);
  const key =
    process.env.AGENTFORCE_APPWRITE_API_KEY ||
    process.env.APPWRITE_API_KEY ||
    process.env.AGENTFORCE_APPWRITE_SETUP_API_KEY ||
    process.env.APPWRITE_SETUP_API_KEY;
  if (!key) throw new Error("Missing operator database credentials.");
  const db = new TablesDB(
    new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(key),
  );
  const catalog = await db.listRows({
    databaseId: config.databaseId,
    tableId: config.products,
    queries: [Query.equal("owner_user_id", ownerId), Query.limit(200)],
  });
  const products: Product[] = catalog.rows.map((row) => ({
    id: row.$id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: row.price,
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
    updatedAt: row.$updatedAt,
  }));
  const request = "I need 10 wireless mice and 5 USB-C hubs for my office";
  const started = Date.now();
  const result = await interpretRequest(request, products, Date.now() + 24000);
  console.log(
    JSON.stringify(
      {
        request,
        source: result.fallback ? "fallback" : "LLM",
        provider: ["gemini", "openai", "anthropic"].includes(
          process.env.LLM_PROVIDER || "",
        )
          ? process.env.LLM_PROVIDER
          : "none",
        model:
          process.env.LLM_PROVIDER === "gemini" &&
          /^gemini-[a-z0-9.-]+$/.test(
            process.env.LLM_MODEL || process.env.GEMINI_MODEL || "",
          )
            ? process.env.LLM_MODEL || process.env.GEMINI_MODEL
            : undefined,
        durationMs: Date.now() - started,
        fallbackReason: result.fallbackReason,
        providerStatus: result.providerStatus,
        interpretation: result.interpretation,
        stockChecks: result.interpretation.items.map((item) => {
          const stock = checkStock(item.productQuery, item.quantity, products);
          return {
            query: item.productQuery,
            quantity: item.quantity,
            matchedProduct: stock.product?.name ?? null,
            available: stock.available,
            inStock: stock.inStock,
          };
        }),
        databaseWrites: 0,
      },
      null,
      2,
    ),
  );
  // A fallback is useful resilience, but does not pass the AI readiness check.
  if (result.fallback) process.exitCode = 1;
}

const timer = setTimeout(() => {
  console.error(
    "AI check exceeded 30 seconds. Check network connectivity and private configuration.",
  );
  process.exit(1);
}, 30000);
main()
  .catch((error: unknown) => {
    const status =
      typeof error === "object" && error !== null && "code" in error
        ? Number(error.code)
        : undefined;
    console.error(
      status && status >= 400 && status <= 599
        ? `AI check could not read the owner catalog (Appwrite HTTP ${status}).`
        : "AI check could not start. Check private configuration and owner catalog access.",
    );
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timer));
