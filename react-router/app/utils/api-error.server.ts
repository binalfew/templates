import { Prisma } from "~/generated/prisma/client.js";

/**
 * Generic application error with HTTP status code.
 * Extend this class for domain-specific errors.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export function formatErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.code, message: error.message },
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
