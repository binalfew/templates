import { Prisma } from "~/generated/prisma/client.js";
import { ServiceError } from "~/utils/errors/service-error.server";

/**
 * API-specific error subclasses built on ServiceError.
 */
export class NotFoundError extends ServiceError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ServiceError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export function formatErrorResponse(error: unknown): Response {
  if (error instanceof ServiceError) {
    return Response.json(
      { error: error.code ?? "APP_ERROR", message: error.message },
      { status: error.status },
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return Response.json(
      {
        error: "CONFLICT",
        message: "Resource was modified or deleted by another user",
      },
      { status: 409 },
    );
  }

  return Response.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    { status: 500 },
  );
}
