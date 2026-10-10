import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AppwriteException, OAuthProvider } from "node-appwrite";
import { NextResponse } from "next/server";
import { getConfig } from "../appwrite/config";
import { adminAccount, serverTables } from "../appwrite/client";
import { safeAuthRedirect } from "../auth-redirect";
import { finishAuthentication, requireSignedOut } from "./auth";
import { ApiError } from "./errors";
import { checkOrigin, respond } from "./http";
import { rateLimit } from "./rate-limit";
import { queryParams, resourceId } from "./validation";

export const OAUTH_STATE_COOKIE = "agentforce_oauth_state";
const challengeId = (state: string) =>
  createHash("sha256").update(`oauth:${state}`).digest("hex").slice(0, 32);
const cookieOptions = () => ({
  httpOnly: true,
  secure: getConfig().origin.startsWith("https:"),
  sameSite: "lax" as const,
  path: "/api/auth/google",
});
function clearState(response: Response) {
  // Cleanup must also succeed when respond() handled invalid server configuration.
  response.headers.append(
    "Set-Cookie",
    `${OAUTH_STATE_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0${process.env.APP_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`,
  );
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
async function nextFromForm(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0] !==
    "application/x-www-form-urlencoded"
  )
    throw new ApiError(
      415,
      "Use the Google sign-in button to start authentication.",
    );
  const reader = request.body?.getReader();
  if (!reader) return "/";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new ApiError(413, "Sign-in request is too large.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  if (
    [...body.keys()].some((key) => key !== "next") ||
    body.getAll("next").length > 1
  )
    throw new ApiError(400, "Invalid sign-in request.");
  const next = body.get("next") || "/";
  if (safeAuthRedirect(next) !== next)
    throw new ApiError(400, "Invalid sign-in destination.");
  return next;
}

export async function startGoogle(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    await requireSignedOut(request);
    const next = await nextFromForm(request);
    const config = getConfig();
    const db = serverTables(request);
    await rateLimit(db, "oauth:start:global", 30);
    const state = randomBytes(32).toString("hex");
    const args = {
      databaseId: config.databaseId,
      tableId: config.rateLimits,
      rowId: challengeId(state),
    };
    await db.createRow({
      ...args,
      data: {
        count: 1,
        expires_at: new Date(Date.now() + 600000).toISOString(),
      },
      permissions: [],
    });
    try {
      const callback = `${config.origin}/api/auth/google/callback`;
      const redirect = await adminAccount(request).createOAuth2Token({
        provider: OAuthProvider.Google,
        success: callback,
        failure: `${callback}?failure=1`,
        state,
      });
      let destination: URL;
      try {
        destination = new URL(redirect);
      } catch {
        // SDK redirects may be empty when provider/project configuration fails.
        throw new ApiError(
          503,
          "Google sign-in is unavailable. Check the project's OAuth settings.",
        );
      }
      if (
        destination.protocol !== "https:" ||
        destination.hostname !== "accounts.google.com" ||
        destination.port ||
        destination.username ||
        destination.password
      )
        throw new ApiError(
          503,
          "Google sign-in is unavailable. Check the project's OAuth settings.",
        );
      const response = NextResponse.redirect(destination, 303);
      response.cookies.set(
        OAUTH_STATE_COOKIE,
        `${state}.${Buffer.from(next).toString("base64url")}`,
        { ...cookieOptions(), maxAge: 600 },
      );
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    } catch (error) {
      await db.deleteRow(args).catch(() => undefined);
      if (error instanceof AppwriteException)
        throw new ApiError(
          503,
          "Google sign-in is unavailable. Check Appwrite OAuth and Web platform settings.",
        );
      throw error;
    }
  });
}

export async function googleCallback(request: Request) {
  const response = await respond(async () => {
    const query = queryParams(request, [
      "state",
      "userId",
      "secret",
      "failure",
      "error",
      "error_description",
    ]);
    const cookies =
      request.headers
        .get("cookie")
        ?.split(";")
        .map((part) => part.trim())
        .filter((part) => part.startsWith(`${OAUTH_STATE_COOKIE}=`)) || [];
    const cookie =
      cookies.length === 1
        ? cookies[0].slice(OAUTH_STATE_COOKIE.length + 1)
        : "";
    const parsedCookie = /^([a-f0-9]{64})\.([A-Za-z0-9_-]{1,4096})$/.exec(
      cookie,
    );
    const state = query.get("state") || "";
    if (
      !parsedCookie ||
      !/^[a-f0-9]{64}$/.test(state) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(parsedCookie[1]))
    )
      throw new ApiError(
        403,
        "Invalid or expired Google sign-in. Start again from the sign-in page.",
      );
    const next = Buffer.from(parsedCookie[2], "base64url").toString("utf8");
    if (safeAuthRedirect(next) !== next)
      throw new ApiError(400, "Invalid sign-in destination.");
    await requireSignedOut(request);
    const config = getConfig();
    const db = serverTables(request);
    const args = {
      databaseId: config.databaseId,
      tableId: config.rateLimits,
      rowId: challengeId(state),
    };
    try {
      const challenge = await db.getRow(args);
      if (
        !Number.isFinite(Date.parse(challenge.expires_at)) ||
        Date.parse(challenge.expires_at) <= Date.now()
      ) {
        await db.deleteRow(args);
        throw new ApiError(
          403,
          "Google sign-in expired. Start again from the sign-in page.",
        );
      }
      // Atomic delete: only one concurrent callback can consume this challenge.
      await db.deleteRow(args);
    } catch (error) {
      if (error instanceof AppwriteException && [404, 409].includes(error.code))
        throw new ApiError(
          403,
          "This Google sign-in has already been used or expired. Start again.",
        );
      throw error;
    }
    if (query.has("failure") || query.has("error"))
      return NextResponse.redirect(
        `${config.origin}/login?authError=google_cancelled`,
        303,
      );
    const userId = query.get("userId");
    const secret = query.get("secret");
    if (
      !resourceId.safeParse(userId).success ||
      !secret ||
      secret.length > 2048 ||
      /[\x00-\x20\x7f]/.test(secret)
    )
      throw new ApiError(400, "Invalid Google sign-in callback. Start again.");
    await rateLimit(db, "oauth:callback:global", 60);
    try {
      const session = await adminAccount(request).createSession({
        userId: userId!,
        secret,
      });
      return await finishAuthentication(
        session,
        () => NextResponse.redirect(new URL(next, config.origin), 303),
        userId!,
      );
    } catch (error) {
      if (
        error instanceof AppwriteException &&
        [400, 401, 403, 404].includes(error.code)
      )
        throw new ApiError(
          401,
          "Google sign-in could not complete. Start again from the sign-in page.",
        );
      throw error;
    }
  });
  return clearState(response);
}
