import { z } from "zod";
import { AppwriteException, ID } from "node-appwrite";
import { NextResponse } from "next/server";
import { adminAccount, serverTables } from "@/lib/appwrite/client";
import { finishAuthentication, requireSignedOut } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { checkOrigin, respond, unsupported } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { readJson } from "@/lib/server/validation";

const registration = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(128)
      .regex(/^[^\x00-\x1f\x7f]+$/, "Enter a valid name."),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(8, "Use at least 8 characters.").max(256),
    confirmPassword: z.string().min(8).max(256),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export function POST(request: Request) {
  return respond(async () => {
    checkOrigin(request);
    await requireSignedOut(request);
    const input = await readJson(request, registration);
    const db = serverTables(request);
    await rateLimit(db, "signup:global", 20);
    await rateLimit(db, `signup:${input.email}`, 3);
    const account = adminAccount(request);
    let user;
    try {
      user = await account.create({
        userId: ID.unique(),
        name: input.name,
        email: input.email,
        password: input.password,
      });
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 409)
        throw new ApiError(
          409,
          "An account with this email already exists. Sign in instead.",
        );
      if (error instanceof AppwriteException && error.code === 400)
        throw new ApiError(
          422,
          "Registration could not be completed. Check your details and the password requirements.",
        );
      throw error;
    }
    try {
      const session = await account.createEmailPasswordSession({
        email: input.email,
        password: input.password,
      });
      return await finishAuthentication(
        session,
        (owner) =>
          NextResponse.json(
            {
              data: {
                user: { id: owner.$id, name: owner.name, email: owner.email },
              },
            },
            { status: 201 },
          ),
        user.$id,
      );
    } catch {
      // Keep the created account recoverable through existing email/password login.
      throw new ApiError(
        503,
        "Your account was created, but sign-in could not complete. Use the sign-in page to try again.",
      );
    }
    // New accounts deliberately receive no seeded business rows or demo inventory.
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
