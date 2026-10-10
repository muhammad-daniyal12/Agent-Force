import { existsSync } from "node:fs";
import { AppwriteException, Client, Query, TablesDB } from "node-appwrite";
import { getConfig, getServerKey } from "../src/lib/appwrite/config";
import { ApiError } from "../src/lib/server/errors";

// Operator-only, read-only check. Never print keys, SDK payloads, or row contents.
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const config = getConfig();
  console.log(`Configured endpoint: ${config.endpoint}`);
  console.log(`Configured project: ${config.projectId}`);

  const response = await fetch(`${config.endpoint}/account`, {
    headers: { "X-Appwrite-Project": config.projectId },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
    cache: "no-store",
  });
  await response.body?.cancel();
  if (response.status !== 401)
    throw new ApiError(
      503,
      `Unexpected anonymous API response (HTTP ${response.status}). Check the endpoint, project ID, and Auth settings.`,
    );
  console.log(
    "Regional API reached; anonymous account access returned HTTP 401.",
  );

  const key = getServerKey();
  const db = new TablesDB(
    new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(key),
  );
  for (const tableId of [
    config.products,
    config.quotations,
    config.runs,
    config.activity,
    config.rateLimits,
    config.settings,
    config.dealers,
    config.restockOrders,
  ]) {
    await db.listRows({
      databaseId: config.databaseId,
      tableId,
      queries: [Query.limit(1), Query.select(["$id"])],
      total: false,
      ttl: 0,
    });
    console.log(`TablesDB read verified: ${tableId}`);
  }
  console.log(
    "Read-only checks passed. No rows, schema, sessions, or deployments were changed. Verify authenticated writes with the demo flow after setup and seed.",
  );
}

// The SDK has no per-request timeout option. Bound this standalone check overall.
const timeout = setTimeout(() => {
  console.error("Connection check timed out. Check regional API connectivity.");
  process.exit(1);
}, 30000);

main()
  .catch((error: unknown) => {
    if (error instanceof ApiError) console.error(error.message);
    else if (error instanceof AppwriteException)
      console.error(
        `TablesDB check failed (HTTP ${error.code}). Check the runtime key, rows.read scope, and provisioned database/table IDs.`,
      );
    else
      console.error(
        "Connection check failed. Check local configuration and network access.",
      );
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timeout));
