import { z } from "zod";
import { AppwriteException } from "node-appwrite";
import { adminAccount, serverTables } from "@/lib/appwrite/client";
import { finishAuthentication, requireSignedOut } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { checkOrigin, respond, unsupported } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { readJson } from "@/lib/server/validation";

/** Private diagnostics: never log credentials, request bodies or SDK messages. */
async function authStep<T>(
  stage: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppwriteException) {
      console.error(
        JSON.stringify({
          event: "login_appwrite_step_failed",
          stage,
          code: error.code,
          type: error.type,
        }),
      );
    }
    throw error;
  }
}

export function POST(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    const input = await readJson(
      request,
      z
        .object({
          email: z.email().trim().max(254),
          password: z.string().min(1).max(256),
        })
        .strict(),
    );
    await requireSignedOut(request);
    const db = serverTables(request);
    await authStep("global-rate-limit", () =>
      rateLimit(db, "login:global", 100),
    );
    await authStep("email-rate-limit", () =>
      rateLimit(db, `login:${input.email.toLowerCase()}`, 10),
    );
    let session;
    try {
      session = await authStep("create-session", () =>
        adminAccount(request).createEmailPasswordSession(input),
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        [400, 401, 403, 404].includes(Number(error.code))
      )
        throw new ApiError(401, "Invalid email or password.");
      throw error;
    }
    return authStep("verify-session", () => finishAuthentication(session));
  });
}
const other = () => unsupported(["POST"]);
export {
  other as GET,
  other as PUT,
  other as PATCH,
  other as DELETE,
  other as OPTIONS,
};
