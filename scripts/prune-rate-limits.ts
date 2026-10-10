import { Query } from "node-appwrite";
import { scriptEnvironment, reportScriptFailure } from "./environment";

async function main() {
  const { config, db } = scriptEnvironment();
  const result = await db.deleteRows({ databaseId: config.databaseId, tableId: config.rateLimits, queries: [Query.lessThan("expires_at", new Date().toISOString())] });
  console.log(`Expired rate-limit buckets removed: ${result.total}.`);
}
main().catch(reportScriptFailure);
