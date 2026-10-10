import "server-only";
import type { Models } from "node-appwrite";
import { NextResponse } from "next/server";
import { getConfig } from "../appwrite/config";
import { sessionAccount } from "../appwrite/client";
import { ApiError } from "./errors";
import { requireOwner, SESSION_COOKIE, sessionSecret } from "./http";

export async function requireSignedOut(request: Request) {
  if (!sessionSecret(request)) return;
  try {
    await requireOwner(request);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return;
    throw error;
  }
  throw new ApiError(
    409,
    "Already signed in. Log out before switching accounts.",
  );
}

export async function finishAuthentication(
  session: Models.Session,
  responseForUser: (user: Models.User<Models.Preferences>) => NextResponse = (
    user,
  ) =>
    NextResponse.json({
      data: { user: { id: user.$id, name: user.name, email: user.email } },
    }),
  expectedUserId?: string,
) {
  if (!session.secret)
    throw new ApiError(
      503,
      "Session creation failed. Check the server authentication scope.",
    );
  const account = sessionAccount(session.secret);
  try {
    const user = await account.get();
    if (!user.status || (expectedUserId && user.$id !== expectedUserId))
      throw new ApiError(401, "Authentication could not be verified.");
    const expires = new Date(session.expire);
    if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now())
      throw new ApiError(401, "The sign-in session has expired.");
    const response = responseForUser(user);
    response.cookies.set(SESSION_COOKIE, session.secret, {
      httpOnly: true,
      secure: getConfig().origin.startsWith("https:"),
      sameSite: "lax",
      path: "/",
      expires,
    });
    return response;
  } catch (error) {
    // Revoke a session that failed verification; never return its secret in JSON.
    await account
      .deleteSession({ sessionId: "current" })
      .catch(() => undefined);
    throw error;
  }
}
