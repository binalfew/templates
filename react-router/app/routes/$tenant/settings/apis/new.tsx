import { useState, useCallback } from "react";
import { data, useActionData, Form, Link } from "react-router";

export const handle = { breadcrumb: "Create API Key" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { createApiKey } from "~/services/api-keys.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { buildServiceContext } from "~/utils/request-context.server";
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
import { Badge } from "~/components/ui/badge";
import { Shield } from "lucide-react";
import { RawKeyAlert } from "./shared";
import type { Route } from "./+types/new";

// --- Constants ---

const API_PERMISSION_GROUPS = [
  {
    label: "Users",
    permissions: [
      { value: "user:read", label: "Read" },
      { value: "user:write", label: "Write" },
      { value: "user:*", label: "All" },
    ],
  },
  {
    label: "Roles",
    permissions: [
      { value: "role:read", label: "Read" },
      { value: "role:write", label: "Write" },
      { value: "role:*", label: "All" },
    ],
  },
  {
    label: "Tenants",
    permissions: [
      { value: "tenant:read", label: "Read" },
      { value: "tenant:write", label: "Write" },
      { value: "tenant:*", label: "All" },
    ],
  },
  {
    label: "Permissions",
    permissions: [{ value: "permission:read", label: "Read" }],
  },
  {
    label: "Settings",
    permissions: [
      { value: "setting:read", label: "Read" },
      { value: "setting:write", label: "Write" },
      { value: "setting:*", label: "All" },
    ],
  },
];

const RATE_LIMIT_TIERS = [
  { value: "10", label: "10 requests/min" },
  { value: "30", label: "30 requests/min" },
  { value: "50", label: "50 requests/min" },
  { value: "100", label: "100 requests/min" },
  { value: "500", label: "500 requests/min" },
  { value: "1000", label: "1,000 requests/min" },
];

// --- Loader ---

export async function loader({ request }: Route.LoaderArgs) {
  await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.REST_API);
  return {};
}

// --- Action ---

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.REST_API);

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const permissions = formData.getAll("permissions") as string[];
  const rateLimitValue = parseInt((formData.get("rateLimitTier") as string) || "100");
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
        rateLimitTier: "CUSTOM" as const,
        rateLimitCustom: rateLimitValue,
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

const ALL_PERMISSION_VALUES = API_PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.value),
);

export default function NewApiKeyPage() {
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((value: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      // If wildcard is unchecked after individual change, remove it
      if (value !== "*" && next.has("*") && !ALL_PERMISSION_VALUES.every((v) => next.has(v))) {
        next.delete("*");
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((group: (typeof API_PERMISSION_GROUPS)[number]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const groupValues = group.permissions.map((p) => p.value);
      const allSelected = groupValues.every((v) => next.has(v));
      for (const v of groupValues) {
        if (allSelected) next.delete(v);
        else next.add(v);
      }
      if (next.has("*") && !ALL_PERMISSION_VALUES.every((v) => next.has(v))) {
        next.delete("*");
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.has("*")) return new Set();
      return new Set([...ALL_PERMISSION_VALUES, "*"]);
    });
  }, []);

  const selectedCount = selected.has("*")
    ? ALL_PERMISSION_VALUES.length
    : ALL_PERMISSION_VALUES.filter((v) => selected.has(v)).length;

  // After successful creation, show the raw key instead of the form
  if (actionData && "rawKey" in actionData && typeof actionData.rawKey === "string") {
    return (
      <RawKeyAlert rawKey={actionData.rawKey}>
        <Button asChild className="w-full sm:w-auto">
          <Link to={`${base}/settings/apis`}>Go to API Keys</Link>
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
                  defaultValue="100"
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-muted-foreground" />
                <CardTitle>Permissions</CardTitle>
              </div>
              <Badge variant={selectedCount > 0 ? "default" : "secondary"}>
                {selectedCount} / {ALL_PERMISSION_VALUES.length} selected
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox
                  name="permissions"
                  value="*"
                  checked={selected.has("*")}
                  onCheckedChange={toggleAll}
                />
                Grant all permissions
              </label>
              <span className="text-xs text-muted-foreground">Full API access</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {API_PERMISSION_GROUPS.map((group) => {
                const groupValues = group.permissions.map((p) => p.value);
                const groupSelectedCount = groupValues.filter(
                  (v) => selected.has(v) || selected.has("*"),
                ).length;
                const allGroupSelected = groupSelectedCount === groupValues.length;

                return (
                  <div
                    key={group.label}
                    className={`rounded-md border p-3 space-y-2 transition-colors ${
                      allGroupSelected ? "border-primary/50 bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {group.label}
                      </button>
                      <Badge variant="outline" className="text-xs">
                        {groupSelectedCount}/{groupValues.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {group.permissions.map((perm) => (
                        <label
                          key={perm.value}
                          className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Checkbox
                            name="permissions"
                            value={perm.value}
                            checked={selected.has(perm.value) || selected.has("*")}
                            onCheckedChange={() => toggle(perm.value)}
                          />
                          {perm.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto">
            Create Key
          </Button>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/apis`}>Cancel</Link>
          </Button>
        </div>
      </Form>
    </div>
  );
}
