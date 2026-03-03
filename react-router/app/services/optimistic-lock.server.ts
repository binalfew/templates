export class ConflictError extends Error {
  public readonly statusCode = 409;
  public readonly code = "CONFLICT";
  public readonly currentResource: Record<string, unknown>;

  constructor(message: string, currentResource: Record<string, unknown>) {
    super(message);
    this.name = "ConflictError";
    this.currentResource = currentResource;
  }
}

export class PreconditionRequiredError extends Error {
  public readonly statusCode = 428;
  public readonly code = "PRECONDITION_REQUIRED";

  constructor(message: string) {
    super(message);
    this.name = "PreconditionRequiredError";
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

export class NotFoundError extends Error {
  public readonly statusCode = 404;
  public readonly code = "NOT_FOUND";

  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export function isPrismaNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  );
}
