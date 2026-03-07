import { ServiceError } from "~/utils/errors/service-error.server";

export class ConflictError extends ServiceError {
  public readonly currentResource: Record<string, unknown>;

  constructor(message: string, currentResource: Record<string, unknown>) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
    this.currentResource = currentResource;
  }
}

export class PreconditionRequiredError extends ServiceError {
  constructor(message: string) {
    super(message, 428, "PRECONDITION_REQUIRED");
    this.name = "PreconditionRequiredError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export function checkOptimisticLock<T extends { updatedAt: Date }>(
  resource: T | null,
  expectedVersion: string | null,
  resourceType: string,
): T {
  if (!resource) {
    throw new NotFoundError(`${resourceType} not found`);
  }

  if (!expectedVersion) {
    throw new PreconditionRequiredError(
      `Version required: include If-Match header or _version form field when updating ${resourceType}`,
    );
  }

  const currentVersion = resource.updatedAt.toISOString();
  if (currentVersion !== expectedVersion) {
    throw new ConflictError(
      `${resourceType} was modified by another user`,
      resource as unknown as Record<string, unknown>,
    );
  }

  return resource;
}

export function getExpectedVersion(request: Request): string | null {
  const ifMatch = request.headers.get("If-Match");
  if (ifMatch) {
    return ifMatch.replace(/^W\//, "").replace(/^"/, "").replace(/"$/, "");
  }
  return null;
}

export async function getExpectedVersionFromFormData(request: Request): Promise<string | null> {
  const formData = await request.clone().formData();
  const version = formData.get("_version");
  return typeof version === "string" && version ? version : null;
}

export function withVersionCheck(
  where: Record<string, unknown>,
  expectedVersion: Date,
): Record<string, unknown> {
  return {
    ...where,
    updatedAt: expectedVersion,
  };
}

export function isPrismaNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  );
}
