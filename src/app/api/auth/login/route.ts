import { z } from "zod";
import { NextResponse } from "next/server";
import { getConfig } from "@/lib/appwrite/config";
import { adminAccount, serverTables, sessionAccount } from "@/lib/appwrite/client";
import { ApiError } from "@/lib/server/errors";
import { checkOrigin, requireOwner, respond, SESSION_COOKIE, sessionSecret, unsupported } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { readJson } from "@/lib/server/validation";
export const runtime = "nodejs";
export function POST(request: Request) { return respond(async () => {
  checkOrigin(request);
  const input = await readJson(request, z.object({ email: z.email().trim().max(254), password: z.string().min(1).max(256) }).strict());
  if (sessionSecret(request)) { try { await requireOwner(request); throw new ApiError(409, "Already signed in. Log out before switching accounts."); } catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; } }
  const db = serverTables(request);
  await rateLimit(db, "login:global", 100);
  await rateLimit(db, `login:${input.email.toLowerCase()}`, 10);
  let session;
  try { session = await adminAccount(request).createEmailPasswordSession(input); }
  catch (error) { if (typeof error === "object" && error !== null && "code" in error && [400, 401, 403, 404].includes(Number(error.code))) throw new ApiError(401, "Invalid email or password."); throw error; }
  if (!session.secret) throw new ApiError(503, "Session creation failed. Check the server authentication scope.");
  const user = await sessionAccount(session.secret).get();
  const response = NextResponse.json({ data: { user: { id: user.$id, name: user.name, email: user.email } } });
  response.cookies.set(SESSION_COOKIE, session.secret, { httpOnly: true, secure: getConfig().origin.startsWith("https:"), sameSite: "lax", path: "/", expires: new Date(session.expire) });
  return response;
}); }
const other = () => unsupported(["POST"]);
export { other as GET, other as PUT, other as PATCH, other as DELETE, other as OPTIONS };

