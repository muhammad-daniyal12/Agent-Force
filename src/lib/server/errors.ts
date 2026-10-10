import { AppwriteException } from "node-appwrite";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function publicError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError)
    return new ApiError(
      422,
      "Invalid request: " +
        error.issues
          .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
          .join("; "),
    );
  if (error instanceof AppwriteException) {
    if (error.code === 409)
      return new ApiError(
        409,
        "The record changed or already exists. Refresh and try again.",
      );
    return new ApiError(
      503,
      "The database service is unavailable. Check backend configuration or try again.",
    );
  }
  return new ApiError(500, "An unexpected backend error occurred.");
}
