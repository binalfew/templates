import { data, redirect, useLoaderData, useActionData, Form, Link } from "react-router";

export const handle = { breadcrumb: "Revoke API Key" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getApiKey, revokeApiKey } from "~/services/api-keys.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { buildServiceContext } from "~/utils/request-context.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { API_KEY_STATUS_VARIANTS } from "../shared";
import type { Route } from "./+types/delete";

// --- Loader ---

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.REST_API);

  const apiKey = await getApiKey(params.apiKeyId, tenantId);
  if (!apiKey) {
    throw data("API key not found", { status: 404 });
  }

  return { apiKey };
}

// --- Action ---

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.REST_API);

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await revokeApiKey(params.apiKeyId, ctx);
    return redirect(`/${params.tenant}/settings/apis`);
  } catch (error) {
    return handleServiceError(error);
  }
}

// --- Component ---

export default function RevokeApiKeyPage() {
  const { apiKey } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Revoke API Key</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before revoking this API key.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="font-medium text-foreground">Name</span>
              <p className="text-muted-foreground">{apiKey.name}</p>
            </div>
            {apiKey.description && (
              <div>
                <span className="font-medium text-foreground">Description</span>
                <p className="text-muted-foreground">{apiKey.description}</p>
              </div>
            )}
            <div>
              <span className="font-medium text-foreground">Key Prefix</span>
              <p className="mt-0.5">
                <Badge variant="outline">
                  <code className="text-xs">{apiKey.keyPrefix}...</code>
                </Badge>
              </p>
            </div>
            <div>
              <span className="font-medium text-foreground">Status</span>
              <div className="mt-0.5">
                <Badge variant={API_KEY_STATUS_VARIANTS[apiKey.status] ?? "secondary"}>
                  {apiKey.status}
                </Badge>
              </div>
            </div>
            <div>
              <span className="font-medium text-foreground">Rate Limit</span>
              <p className="text-muted-foreground">{apiKey.rateLimitTier}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Usage Count</span>
              <p className="text-muted-foreground">{apiKey.usageCount}</p>
            </div>
          </div>

          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This action cannot be undone. The API key will be immediately disabled and all requests
            using it will fail.
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Form method="post">
              <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                Revoke Key
              </Button>
            </Form>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to={`${base}/settings/apis`}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
