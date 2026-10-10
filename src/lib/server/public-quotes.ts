import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { AppwriteException, Query, type TablesDB } from "node-appwrite";
import { ApiError } from "./errors";
import { checkOrigin, json, respond } from "./http";
import { serverTables } from "../appwrite/client";
import { getConfig } from "../appwrite/config";
import { quoteDto } from "./mappers";
import { rateLimit } from "./rate-limit";
import { BusinessStore, type BusinessRow } from "./store";
import { readSettings } from "./settings";

const shareTokenPattern = /^[A-Za-z0-9_-]{43,96}$/;

function validatedToken(raw: string): string {
  if (!shareTokenPattern.test(raw))
    throw new ApiError(404, "Quotation link not found.");
  return raw;
}

// Never trust an arbitrary user-supplied X-Forwarded-For value. Enable this
// only when a controlled reverse proxy replaces the incoming IP headers.
// Otherwise all unknown IPs share a conservative per-IP budget.
function clientIpBucket(request: Request): string {
  if (process.env.TRUST_PROXY_IP_HEADERS !== "true") return "unknown-ip";
  const candidate = (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    ""
  ).trim();
  return isIP(candidate) ? candidate : "unknown-ip";
}

async function requireSharedQuote(
  db: TablesDB,
  token: string,
  transactionId?: string,
): Promise<BusinessRow> {
  const config = getConfig();
  const matches = await db.listRows<BusinessRow>({
    databaseId: config.databaseId,
    tableId: config.quotations,
    queries: [Query.equal("shareToken", token), Query.limit(2)],
    total: false,
    ttl: 0,
    transactionId,
  });
  if (matches.rows.length !== 1)
    throw new ApiError(404, "Quotation link not found.");
  return matches.rows[0];
}

export async function handlePublicQuote(
  request: Request,
  rawToken: string,
  method: "GET" | "POST",
): Promise<Response> {
  const response = await respond(async () => {
    if (method === "POST") checkOrigin(request);
    const db = serverTables(request);
    const token = validatedToken(rawToken);
    const hashedToken = createHash("sha256").update(token).digest("hex");
    const ip = clientIpBucket(request);

    // Enforce independent global, IP, and bearer-token rate limits.
    // The token cap cannot be bypassed by spoofing a forwarded IP header.
    await rateLimit(db, "public:" + method + ":global", method === "GET" ? 500 : 120);
    await rateLimit(db, "public:" + method + ":ip:" + ip, method === "GET" ? 80 : 20);
    await rateLimit(db, "public:" + method + ":token:" + hashedToken, method === "GET" ? 30 : 8);

    const original = await requireSharedQuote(db, token);
    const quote = quoteDto(original);
    if (quote.status !== "approved" || quote.shareToken !== token)
      throw new ApiError(method === "POST" ? 409 : 404,
        method === "POST" ? "Only approved quotations can be accepted." : "Quotation link not found.");

    if (method === "GET") {
      const store = new BusinessStore(db, original.owner_user_id);
      const settings = await readSettings(store, "Business");
      return safeResponse(json({
        businessName: settings.name,
        businessCity: settings.city,
        businessPhone: settings.phone,
        quotationNumber: "QUO-" + quote.id.slice(-6).toUpperCase(),
        customerName: quote.customerName,
        items: quote.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        subtotal: quote.subtotal,
        discount: quote.discount,
        tax: quote.tax,
        total: quote.total,
        status: quote.status,
        customerResponse: quote.customerResponse ?? null,
        createdAt: quote.createdAt,
      }));
    }

    const store = new BusinessStore(db, original.owner_user_id);
    try {
      await store.transaction(async (transactionId) => {
        const row = quoteDto(await store.get("quotations", quote.id, transactionId));
        if (row.shareToken !== token)
          throw new ApiError(404, "Quotation link not found.");
        if (row.status !== "approved")
          throw new ApiError(409, "Only approved quotations can be accepted.");
        if (row.customerResponse === "accepted") return;
        await store.update("quotations", row.id, {
          customerResponse: "accepted",
          respondedAt: new Date().toISOString(),
        }, transactionId);
        await store.activity(
          "Customer",
          "Customer accepted QUO-" + row.id.slice(-6).toUpperCase(),
          row.id,
          transactionId,
        );
      });
    } catch (error) {
      // Concurrent identical acceptance: the winning transaction already
      // persisted the acceptance. Return its original timestamp.
      if (!(error instanceof AppwriteException && error.code === 409)) throw error;
      const latest = quoteDto(await store.get("quotations", quote.id));
      if (latest.customerResponse !== "accepted" || latest.shareToken !== token) throw error;
    }

    const accepted = quoteDto(await store.get("quotations", quote.id));
    if (accepted.customerResponse !== "accepted" || !accepted.respondedAt)
      throw new ApiError(503, "Quotation acceptance could not be confirmed.");
    return safeResponse(json({
      customerResponse: "accepted",
      respondedAt: accepted.respondedAt,
    }));
  });
  return safeResponse(response);
}

function safeResponse(response: Response): Response {
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
