import { validateApiKey } from "~/services/api-keys.server";
import type { ValidatedApiKey } from "~/services/api-keys.server";

export interface ApiAuthResult {
  tenantId: string;
  apiKeyId: string;
  permissions: string[];
}

export async function apiAuth(request: Request): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = authHeader.slice(7);
  const apiKey = await validateApiKey(token);

  if (!apiKey) {
    throw new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid or expired API key" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  return {
    tenantId: apiKey.tenantId,
    apiKeyId: apiKey.apiKeyId,
    permissions: apiKey.permissions,
  };
}

export function requireApiPermission(auth: ApiAuthResult, permission: string) {
  if (!auth.permissions.includes(permission) && !auth.permissions.includes("*")) {
    throw new Response(
      JSON.stringify({
        error: { code: "FORBIDDEN", message: `Missing permission: ${permission}` },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
}
