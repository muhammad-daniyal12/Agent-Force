import { NextResponse } from "next/server";
import { sessionAccount } from "@/lib/appwrite/client";
import {
  checkOrigin,
  requireOwner,
  respond,
  SESSION_COOKIE,
  sessionSecret,
  unsupported,
} from "@/lib/server/http";
export async function POST(request: Request) {
  const response = await respond(async () => {
    checkOrigin(request);
    await requireOwner(request);
    await sessionAccount(sessionSecret(request)!).deleteSession({
      sessionId: "current",
    });
    return NextResponse.json({ data: { loggedOut: true } });
  });
  if (response.ok || response.status === 401)
    response.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.APP_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`,
    );
  return response;
}
const other = () => unsupported(["POST"]);
export {
  other as GET,
  other as PUT,
  other as PATCH,
  other as DELETE,
  other as OPTIONS,
};
