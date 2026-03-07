import { useState } from "react";
import { data, Form, useLoaderData, useActionData, useFetcher } from "react-router";
import { Pencil, X, Check } from "lucide-react";

export const handle = { breadcrumb: "General" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { getAllSettings, setSetting, deleteSetting } from "~/utils/config/settings.server";
import type { ResolvedSetting } from "~/utils/config/settings.server";
import { upsertSettingSchema, SETTING_CATEGORIES } from "~/utils/schemas/settings";
import { buildServiceContext } from "~/utils/request-context.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Separator } from "~/components/ui/separator";
import { Field } from "~/components/ui/field";
import type { Route } from "./+types/index";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  const tenantId = user.tenantId;

  const settingsByCategory = await getAllSettings(tenantId ? { tenantId } : undefined);

  return { settingsByCategory };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  const ctx = buildServiceContext(request, user);

  if (_action === "upsert") {
    const raw = {
      key: formData.get("key"),
      value: formData.get("value"),
      type: formData.get("type") || "string",
      category: formData.get("category"),
      scope: formData.get("scope") || "global",
      scopeId: formData.get("scopeId") || "",
    };

    const result = upsertSettingSchema.safeParse(raw);
    if (!result.success) {
      return data({ error: result.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
    }

    await setSetting(result.data, ctx);
    return data({ success: true });
  }

  if (_action === "delete") {
    const key = formData.get("key") as string;
    const scope = formData.get("scope") as string;
    const scopeId = (formData.get("scopeId") as string) || "";
    await deleteSetting(key, scope, scopeId, ctx);
    return data({ success: true });
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

const CATEGORY_INFO: Record<string, { title: string; description: string }> = {
  general: { title: "General", description: "Basic application settings" },
  auth: { title: "Authentication", description: "Login and session settings" },
  email: { title: "Email", description: "Email delivery configuration" },
  upload: { title: "Upload", description: "File upload limits and policies" },
  workflow: { title: "Workflow", description: "Workflow automation settings" },
};

export default function SettingsPage() {
  const { settingsByCategory } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const categories = SETTING_CATEGORIES;
  const hasAnySettings = Object.values(settingsByCategory).some((s) => s.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">General Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage application settings across scopes. More specific scopes override broader ones.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      {actionData && "success" in actionData && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          Setting saved successfully.
        </div>
      )}

      <Separator />

      {!hasAnySettings ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No settings configured yet. Default values will be used.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => {
            const settings = settingsByCategory[category] ?? [];
            const info = CATEGORY_INFO[category] ?? {
              title: category,
              description: "",
            };

            if (settings.length === 0) return null;

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{info.title}</CardTitle>
                  <CardDescription>{info.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {settings.map((setting) => (
                      <SettingRow key={setting.key} setting={setting} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add New Setting */}
      <Card>
        <CardHeader>
          <CardTitle>Add Setting</CardTitle>
          <CardDescription>Create or update a setting value.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="POST" className="space-y-4">
            <input type="hidden" name="_action" value="upsert" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field fieldId="key" label="Key" required>
                <Input id="key" name="key" placeholder="e.g. upload.max_file_size_mb" required />
              </Field>
              <Field fieldId="value" label="Value" required>
                <Input id="value" name="value" placeholder="Setting value" required />
              </Field>
              <Field fieldId="category" label="Category" required>
                <NativeSelect id="category" name="category" required>
                  {categories.map((c) => (
                    <NativeSelectOption key={c} value={c}>
                      {CATEGORY_INFO[c]?.title ?? c}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field fieldId="type" label="Type">
                <NativeSelect id="type" name="type">
                  <NativeSelectOption value="string">String</NativeSelectOption>
                  <NativeSelectOption value="number">Number</NativeSelectOption>
                  <NativeSelectOption value="boolean">Boolean</NativeSelectOption>
                  <NativeSelectOption value="json">JSON</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field fieldId="scope" label="Scope">
                <NativeSelect id="scope" name="scope">
                  <NativeSelectOption value="global">Global</NativeSelectOption>
                  <NativeSelectOption value="tenant">Tenant</NativeSelectOption>
                  <NativeSelectOption value="event">Event</NativeSelectOption>
                  <NativeSelectOption value="user">User</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field fieldId="scopeId" label="Scope ID">
                <Input id="scopeId" name="scopeId" placeholder="Leave empty for global" />
              </Field>
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              Save Setting
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({ setting }: { setting: ResolvedSetting }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(setting.value);
  const fetcher = useFetcher();

  const scopeLabel =
    setting.scope === "default"
      ? "Default"
      : setting.scope.charAt(0).toUpperCase() + setting.scope.slice(1);

  const scopeVariant =
    setting.scope === "default" || setting.scope === "global" ? "secondary" : "outline";

  const handleSave = () => {
    const formData = new FormData();
    formData.set("_action", "upsert");
    formData.set("key", setting.key);
    formData.set("value", editValue);
    formData.set("type", setting.type);
    formData.set("category", setting.category);
    formData.set("scope", setting.scope === "default" ? "global" : setting.scope);
    formData.set("scopeId", setting.scopeId);
    fetcher.submit(formData, { method: "post" });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditValue(setting.value);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="text-sm font-medium text-foreground">{setting.key}</code>
          <Badge variant={scopeVariant}>{scopeLabel}</Badge>
        </div>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={handleSave}>
              <Check className="size-4 text-green-600" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{setting.value}</p>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
          {setting.scope !== "default" && (
            <Form method="POST">
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="key" value={setting.key} />
              <input type="hidden" name="scope" value={setting.scope} />
              <input type="hidden" name="scopeId" value={setting.scopeId} />
              <Button type="submit" variant="ghost" size="sm">
                Reset
              </Button>
            </Form>
          )}
        </div>
      )}
    </div>
  );
}
