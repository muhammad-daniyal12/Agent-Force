import "server-only";
import { randomUUID } from "node:crypto";
import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";
import { getConfig } from "../appwrite/config";
import { sessionAccount, serverTables } from "../appwrite/client";
import { ApiError, publicError } from "./errors";
import { rateLimit } from "./rate-limit";
import { BusinessStore } from "./store";

export const SESSION_COOKIE = "agentforce_session";
export function sessionSecret(request: Request): string | undefined {
  const cookie = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return;
  try { return decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)); } catch { return; }
}

export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== getConfig().origin) throw new ApiError(403, "Request origin is not authorized.");
}

export async function requireOwner(request: Request) {
  const secret = sessionSecret(request);
  if (!secret) throw new ApiError(401, "Authentication required.");
  try {
    const user = await sessionAccount(secret).get();
    if (!user.status) throw new ApiError(401, "Authentication required.");
    return user;
  } catch (error) {
    if (error instanceof AppwriteException && [401, 403].includes(error.code)) throw new ApiError(401, "Authentication required.");
    throw error;
  }
}

export function json(data: unknown, status = 200) { return NextResponse.json(data, { status }); }

export async function respond(work: () => Promise<Response>): Promise<Response> {
  const traceId = randomUUID();
  let response: Response;
  try { response = await work(); }
  catch (error) {
    const safe = publicError(error);
    if (safe.status >= 500) console.error(JSON.stringify({ event: "backend_error", traceId, status: safe.status, type: error instanceof Error ? error.name : "UnknownError" }));
    response = NextResponse.json({ error: safe.message }, { status: safe.status, headers: safe.retryAfter ? { "Retry-After": String(safe.retryAfter) } : undefined });
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Request-ID", traceId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export function withOwner<T>(request: Request, work: (store: BusinessStore) => Promise<T>, status = 200): Promise<Response> {
  return respond(async () => {
    const owner = await requireOwner(request);
    if (!["GET", "HEAD"].includes(request.method)) checkOrigin(request);
    const db = serverTables(request);
    await rateLimit(db, `${owner.$id}:api`, 120);
    return json(await work(new BusinessStore(db, owner.$id)), status);
  });
}

export function unsupported(allow: string[]): Response {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: allow.join(", "), "Cache-Control": "private, no-store" } });
}
