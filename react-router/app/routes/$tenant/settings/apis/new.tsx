import { useState, useCallback } from "react";
import { data, useActionData, Form, Link } from "react-router";
import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "Create API Key" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { createApiKey } from "~/services/api-keys.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { buildServiceContext } from "~/utils/request-context.server";
import { createApiKeySchema } from "~/utils/schemas/api-keys";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Field } from "~/components/ui/field";
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
  const submission = parseWithZod(formData, { schema: createApiKeySchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const { name, description, permissions, rateLimitTier, expiresIn, allowedIps } = submission.value;

  let expiresAt: Date | undefined;
  if (expiresIn) {
    const days = parseInt(expiresIn);
    if (days > 0) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
  }

  const parsedIps =
    allowedIps
      ?.split(",")
      .map((ip) => ip.trim())
      .filter(Boolean) ?? [];

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    const result = await createApiKey(
      {
        name,
        description,
        permissions,
        rateLimitTier: "CUSTOM" as const,
        rateLimitCustom: rateLimitTier,
        expiresAt,
        allowedIps: parsedIps,
      },
      ctx,
    );

    return data({ success: true, rawKey: result.rawKey, keyId: result.apiKey.id });
  } catch (error) {
    return handleServiceError(error, { submission });
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

  const [form, fields] = useForm({
    lastResult: actionData && "result" in actionData ? actionData.result : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createApiKeySchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const toggle = useCallback((value: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
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

      <Form method="post" {...getFormProps(form)} className="space-y-6">
        {form.errors && form.errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {form.errors.map((error, i) => (
              <p key={i}>{error}</p>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Key Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field fieldId={fields.name.id} label="Name" required errors={fields.name.errors}>
                <Input
                  {...getInputProps(fields.name, { type: "text" })}
                  key={fields.name.key}
                  placeholder="e.g., Mobile App Integration"
                  className="w-full"
                />
              </Field>
              <Field fieldId={fields.description.id} label="Description" errors={fields.description.errors}>
                <Input
                  {...getInputProps(fields.description, { type: "text" })}
                  key={fields.description.key}
                  placeholder="Optional description"
                  className="w-full"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field fieldId={fields.rateLimitTier.id} label="Rate Limit Tier" errors={fields.rateLimitTier.errors}>
                <NativeSelect
                  id={fields.rateLimitTier.id}
                  name={fields.rateLimitTier.name}
                  key={fields.rateLimitTier.key}
                  defaultValue="100"
                  className="w-full"
                >
                  {RATE_LIMIT_TIERS.map((tier) => (
                    <NativeSelectOption key={tier.value} value={tier.value}>
                      {tier.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field fieldId={fields.expiresIn.id} label="Expires In (days)" errors={fields.expiresIn.errors}>
                <Input
                  {...getInputProps(fields.expiresIn, { type: "number" })}
                  key={fields.expiresIn.key}
                  placeholder="Leave empty for no expiry"
                  className="w-full"
                />
              </Field>
            </div>
            <Field fieldId={fields.allowedIps.id} label="Allowed IPs (comma-separated)" errors={fields.allowedIps.errors}>
              <Input
                {...getInputProps(fields.allowedIps, { type: "text" })}
                key={fields.allowedIps.key}
                placeholder="Leave empty to allow all IPs"
                className="w-full"
              />
            </Field>
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
            {fields.permissions.errors && fields.permissions.errors.length > 0 && (
              <p className="text-sm text-destructive">{fields.permissions.errors[0]}</p>
            )}
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
