import { data, Link, useLoaderData, useFetcher } from "react-router";
import { useState } from "react";

export const handle = { breadcrumb: "API Key Details" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getApiKey, rotateApiKey } from "~/services/api-keys.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { buildServiceContext } from "~/utils/request-context.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Key, ArrowLeft, RotateCw, Trash2 } from "lucide-react";
import { API_KEY_STATUS_VARIANTS, RawKeyAlert } from "../shared";
import type { Route } from "./+types/index";

// --- Loader ---

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.REST_API);

  const apiKey = await getApiKey(params.apiKeyId, tenantId);
  if (!apiKey) {
    throw data("API key not found", { status: 404 });
  }

  return { apiKey };
}

// --- Action (rotate) ---

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.REST_API);

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    if (_action === "rotate") {
      const graceHours = parseInt(formData.get("graceHours") as string) || 24;
      const result = await rotateApiKey(params.apiKeyId, graceHours, ctx);
      return data({ success: true, rawKey: result.rawKey, keyId: result.apiKey.id });
    }

    return data({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return handleServiceError(error);
  }
}

// --- Component ---

export default function ApiKeyDetailPage() {
  const { apiKey } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const fetcher = useFetcher<typeof action>();
  const [rotateOpen, setRotateOpen] = useState(false);

  const rawKey =
    fetcher.data &&
    typeof fetcher.data === "object" &&
    "rawKey" in fetcher.data &&
    typeof fetcher.data.rawKey === "string"
      ? fetcher.data.rawKey
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Key className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">{apiKey.name}</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/api-keys`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          {apiKey.status === "ACTIVE" && (
            <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <RotateCw className="mr-1.5 size-3.5" />
                  Rotate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rotate API Key</DialogTitle>
                  <DialogDescription>
                    This will create a new key and mark the current one as rotated. The old key will
                    remain valid for 24 hours (grace period).
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    onClick={() => {
                      fetcher.submit(
                        { _action: "rotate", graceHours: "24" },
                        { method: "POST" },
                      );
                      setRotateOpen(false);
                    }}
                  >
                    Rotate Key
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {apiKey.status === "ACTIVE" && (
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
              <Link
                to={`${base}/settings/api-keys/${apiKey.id}/delete`}
                className="text-destructive"
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Revoke
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Raw key alert (after rotation) */}
      {rawKey && <RawKeyAlert rawKey={rawKey} />}

      {/* Key Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Key Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{apiKey.name}</span>
            </div>
            {apiKey.description && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description</span>
                <span className="font-medium">{apiKey.description}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Key Prefix</span>
              <Badge variant="outline">
                <code className="text-xs">{apiKey.keyPrefix}...</code>
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={API_KEY_STATUS_VARIANTS[apiKey.status] ?? "secondary"}>
                {apiKey.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate Limit</span>
              <Badge variant="secondary">{apiKey.rateLimitTier}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-muted-foreground">
                {new Date(apiKey.createdAt).toLocaleDateString()}
              </span>
            </div>
            {apiKey.expiresAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires</span>
                <span className="text-muted-foreground">
                  {new Date(apiKey.expiresAt).toLocaleDateString()}
                </span>
              </div>
            )}
            {apiKey.revokedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revoked</span>
                <span className="text-muted-foreground">
                  {new Date(apiKey.revokedAt).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Used</span>
              <span className="text-muted-foreground">
                {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : "Never"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Usage Count</span>
              <span className="font-medium">{apiKey.usageCount}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {apiKey.permissions.map((perm: string) => (
                  <Badge key={perm} variant="outline">
                    <code className="text-xs">{perm}</code>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {apiKey.allowedIps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>IP Restrictions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {apiKey.allowedIps.map((ip: string) => (
                    <Badge key={ip} variant="secondary">
                      <code className="text-xs">{ip}</code>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
