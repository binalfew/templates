import { data, useActionData, Form, Link } from "react-router";

export const handle = { breadcrumb: "Create API Key" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { createApiKey } from "~/services/api-keys.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { buildServiceContext } from "~/lib/request-context.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { RawKeyAlert } from "./shared";
import type { Route } from "./+types/new";

// --- Constants ---

const API_PERMISSIONS = [
  { value: "users:read", label: "Users: Read" },
  { value: "users:create", label: "Users: Create" },
  { value: "users:update", label: "Users: Update" },
  { value: "users:delete", label: "Users: Delete" },
  { value: "users:*", label: "Users: All" },
  { value: "roles:read", label: "Roles: Read" },
  { value: "roles:update", label: "Roles: Update" },
  { value: "roles:*", label: "Roles: All" },
  { value: "tenants:read", label: "Tenants: Read" },
  { value: "tenants:update", label: "Tenants: Update" },
  { value: "tenants:*", label: "Tenants: All" },
  { value: "settings:read", label: "Settings: Read" },
  { value: "settings:update", label: "Settings: Update" },
  { value: "settings:*", label: "Settings: All" },
];

const RATE_LIMIT_TIERS = [
  { value: "STANDARD", label: "Standard (100/min)" },
  { value: "ELEVATED", label: "Elevated (500/min)" },
  { value: "PREMIUM", label: "Premium (2000/min)" },
];

// --- Loader ---

export async function loader({ request }: Route.LoaderArgs) {
  await requireFeature(request, FEATURE_FLAG_KEYS.REST_API);
  return {};
}

// --- Action ---

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.REST_API);

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const permissions = formData.getAll("permissions") as string[];
  const rateLimitTier = (formData.get("rateLimitTier") as string) || "STANDARD";
  const expiresIn = formData.get("expiresIn") as string;
  const allowedIps =
    (formData.get("allowedIps") as string)
      ?.split(",")
      .map((ip) => ip.trim())
      .filter(Boolean) ?? [];

  if (!name) return data({ error: "Name is required" }, { status: 400 });
  if (permissions.length === 0) {
    return data({ error: "At least one permission is required" }, { status: 400 });
  }

  let expiresAt: Date | undefined;
  if (expiresIn) {
    const days = parseInt(expiresIn);
    if (days > 0) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
  }

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    const result = await createApiKey(
      {
        name,
        description,
        permissions,
        rateLimitTier: rateLimitTier as "STANDARD" | "ELEVATED" | "PREMIUM" | "CUSTOM",
        expiresAt,
        allowedIps,
      },
      ctx,
    );

    return data({ success: true, rawKey: result.rawKey, keyId: result.apiKey.id });
  } catch (error) {
    return handleServiceError(error);
  }
}

// --- Component ---

export default function NewApiKeyPage() {
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();

  // After successful creation, show the raw key instead of the form
  if (actionData && "rawKey" in actionData && typeof actionData.rawKey === "string") {
    return (
      <RawKeyAlert rawKey={actionData.rawKey}>
        <Button asChild className="w-full sm:w-auto">
          <Link to={`${base}/settings/api-keys`}>Go to API Keys</Link>
        </Button>
      </RawKeyAlert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create API Key</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new API key for external system integration.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Key Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Mobile App Integration"
                  required
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Optional description"
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rateLimitTier">Rate Limit Tier</Label>
                <NativeSelect
                  id="rateLimitTier"
                  name="rateLimitTier"
                  defaultValue="STANDARD"
                  className="w-full"
                >
                  {RATE_LIMIT_TIERS.map((tier) => (
                    <NativeSelectOption key={tier.value} value={tier.value}>
                      {tier.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresIn">Expires In (days)</Label>
                <Input
                  id="expiresIn"
                  name="expiresIn"
                  type="number"
                  placeholder="Leave empty for no expiry"
                  className="w-full"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowedIps">Allowed IPs (comma-separated)</Label>
              <Input
                id="allowedIps"
                name="allowedIps"
                placeholder="Leave empty to allow all IPs"
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {API_PERMISSIONS.map((perm) => (
                <label key={perm.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox name="permissions" value={perm.value} />
                  {perm.label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto">
            Create Key
          </Button>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/api-keys`}>Cancel</Link>
          </Button>
        </div>
      </Form>
    </div>
  );
}
