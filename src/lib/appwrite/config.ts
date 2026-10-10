import { z } from "zod";
import { ApiError } from "../server/errors";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/);

export function getConfig() {
  const pick = (key: string) =>
    process.env[`AGENTFORCE_${key}`] || process.env[key];
  const onSite = Boolean(process.env.APPWRITE_SITE_ID);
  const parsed = z
    .object({
      endpoint: z.url(),
      projectId: id,
      databaseId: id,
      products: id,
      quotations: id,
      runs: id,
      activity: id,
      rateLimits: id,
      origin: z.url(),
    })
    .safeParse({
      endpoint:
        (onSite ? process.env.APPWRITE_SITE_API_ENDPOINT : undefined) ||
        pick("APPWRITE_ENDPOINT"),
      projectId:
        (onSite ? process.env.APPWRITE_SITE_PROJECT_ID : undefined) ||
        pick("APPWRITE_PROJECT_ID"),
      databaseId: pick("APPWRITE_DATABASE_ID") || "agentforce",
      products: pick("APPWRITE_PRODUCTS_TABLE_ID") || "products",
      quotations: pick("APPWRITE_QUOTATIONS_TABLE_ID") || "quotations",
      runs: pick("APPWRITE_AGENT_RUNS_TABLE_ID") || "agent_runs",
      activity: pick("APPWRITE_ACTIVITY_TABLE_ID") || "activity_logs",
      rateLimits: pick("APPWRITE_RATE_LIMITS_TABLE_ID") || "rate_limits",
      origin: process.env.APP_ORIGIN,
    });
  if (!parsed.success)
    throw new ApiError(
      503,
      "Backend configuration is incomplete. Configure the project endpoint, project ID, and app origin privately.",
    );
  const config = parsed.data;
  const endpoint = new URL(config.endpoint);
  const local =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(endpoint.hostname);
  if (
    (!local && endpoint.protocol !== "https:") ||
    endpoint.pathname.replace(/\/$/, "") !== "/v1" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    /replace_with|<|>/.test(config.endpoint)
  ) {
    throw new ApiError(
      503,
      "Configure the actual Appwrite regional HTTPS endpoint ending in /v1.",
    );
  }
  if (
    new URL(config.origin).origin !== config.origin ||
    (process.env.NODE_ENV === "production" &&
      !config.origin.startsWith("https://"))
  ) {
    throw new ApiError(
      503,
      "APP_ORIGIN must be the exact frontend origin, without a path or trailing slash.",
    );
  }
  return { ...config, endpoint: config.endpoint.replace(/\/$/, "") };
}

export function getServerKey(request?: Request): string {
  // The platform injects this header. Never trust it on a regular local server.
  const siteKey = process.env.APPWRITE_SITE_ID
    ? request?.headers.get("x-appwrite-key")
    : undefined;
  const key =
    siteKey ||
    process.env.AGENTFORCE_APPWRITE_API_KEY ||
    process.env.APPWRITE_API_KEY;
  if (!key || key.startsWith("replace_with_") || key.includes("<"))
    throw new ApiError(
      503,
      "Configure the server API key privately, or grant the Appwrite Site its runtime scopes.",
    );
  return key;
}

export function demoTaxRate(): number {
  const rate = Number(process.env.TAX_RATE ?? "0.08");
  if (!Number.isFinite(rate) || rate < 0 || rate > 1)
    throw new ApiError(
      503,
      "TAX_RATE must be a demo fraction between 0 and 1.",
    );
  return rate;
}

export function workflowTimeoutMs(): number {
  const value = Number(process.env.AGENT_RUN_TIMEOUT_MS ?? "24000");
  if (!Number.isInteger(value) || value < 1000 || value > 24000)
    throw new ApiError(
      503,
      "AGENT_RUN_TIMEOUT_MS must be between 1000 and 24000 for Appwrite Sites.",
    );
  return value;
}
