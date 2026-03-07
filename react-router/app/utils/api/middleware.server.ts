import type { ZodType } from "zod/v4";
import { apiAuth, requireApiPermission, type ApiAuthResult } from "~/utils/auth/api-auth.server";
import { jsonError } from "~/utils/api-response.server";

interface ParseApiRequestOptions<TBody = unknown> {
  permission: string;
  methods?: string[];
  bodySchema?: ZodType<TBody>;
}

interface ParseApiRequestResult<TBody = unknown> {
  auth: ApiAuthResult;
  body: TBody;
}

/**
 * Parse and validate an API request: authenticate, check permissions,
 * validate HTTP method, and parse+validate the JSON body.
 *
 * Throws a JSON error Response on failure.
 */
export async function parseApiRequest<TBody = undefined>(
  request: Request,
  options: ParseApiRequestOptions<TBody>,
): Promise<ParseApiRequestResult<TBody>> {
  const auth = await apiAuth(request);
  requireApiPermission(auth, options.permission);

  if (options.methods && !options.methods.includes(request.method)) {
    throw jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  }

  let body: TBody = undefined as TBody;
  if (options.bodySchema) {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw jsonError("BAD_REQUEST", "Invalid JSON body");
    }
    const result = options.bodySchema.safeParse(raw);
    if (!result.success) {
      throw jsonError("VALIDATION_ERROR", "Validation failed", 400, result.error.issues);
    }
    body = result.data;
  }

  return { auth, body };
}
