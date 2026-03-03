import { data, useFetcher, useLoaderData } from "react-router";
import { useState, useRef } from "react";

export const handle = { breadcrumb: "API Keys" };

import { requirePermission } from "~/lib/require-auth.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { listApiKeys, createApiKey, revokeApiKey, rotateApiKey } from "~/services/api-keys.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
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
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/api-keys";

// --- Available API permissions ---

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
  const { user, roles } = await requirePermission(request, "api-key", "manage");

  const enabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.REST_API, {
    tenantId: user.tenantId ?? undefined,
    roles,
    userId: user.id,
  });

  if (!enabled) {
    return {
      enabled: false,
      keys: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
    };
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const keys = await listApiKeys(user.tenantId!, { page, pageSize: 20 });

  return { enabled: true, keys };
}

// --- Action ---

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "api-key", "manage");
  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  const ctx = buildServiceContext(request, user, user.tenantId!);

  try {
    if (_action === "create") {
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

      const result = await createApiKey(
        {
          name,
          description,
          permissions,
          rateLimitTier: rateLimitTier as any,
          expiresAt,
          allowedIps,
        },
        ctx,
      );

      return data({ success: true, rawKey: result.rawKey, keyId: result.apiKey.id });
    }

    if (_action === "revoke") {
      const id = formData.get("id") as string;
      if (!id) return data({ error: "Key ID is required" }, { status: 400 });
      await revokeApiKey(id, ctx);
      return data({ success: true });
    }

    if (_action === "rotate") {
      const id = formData.get("id") as string;
      const graceHours = parseInt(formData.get("graceHours") as string) || 24;
      if (!id) return data({ error: "Key ID is required" }, { status: 400 });
      const result = await rotateApiKey(id, graceHours, ctx);
      return data({ success: true, rawKey: result.rawKey, keyId: result.apiKey.id });
    }

    return data({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return data({ error: error.message ?? "Operation failed" }, { status: error.status ?? 500 });
  }
}

// --- Component ---

export default function ApiKeysPage() {
  const { enabled, keys } = useLoaderData<typeof loader>();
  const [rawKey, setRawKey] = useState<string | null>(null);

  if (!enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">API Keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            REST API access is currently disabled. Enable the FF_REST_API feature flag to use this
            feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">API Keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage API keys for external integrations. Keys grant programmatic access to the REST
            API.
          </p>
        </div>
        <CreateApiKeyDialog onKeyCreated={setRawKey} />
      </div>

      <Separator />

      {/* Show raw key alert after create/rotate */}
      {rawKey && <RawKeyAlert rawKey={rawKey} onDismiss={() => setRawKey(null)} />}

      {keys.items.length === 0 && !rawKey ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No API keys yet. Create one to get started with the REST API.
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Keys</CardTitle>
            <CardDescription>
              {keys.meta.total} key{keys.meta.total !== 1 ? "s" : ""} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {keys.items.map((key: any) => (
                <ApiKeyRow key={key.id} apiKey={key} onKeyRotated={setRawKey} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Sub-components ---

function RawKeyAlert({ rawKey, onDismiss }: { rawKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
          Save your API key now
        </h3>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0">
          x
        </Button>
      </div>
      <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
        This is the only time you will see this key. Copy it and store it securely.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded bg-yellow-100 p-2 text-xs font-mono break-all dark:bg-yellow-900">
          {rawKey}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(rawKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function CreateApiKeyDialog({ onKeyCreated }: { onKeyCreated: (key: string) => void }) {
  const fetcher = useFetcher<typeof action>();
  const [open, setOpen] = useState(false);
  const prevDataRef = useRef(fetcher.data);

  // When fetcher returns data with a rawKey, surface it to the parent
  if (fetcher.data !== prevDataRef.current) {
    prevDataRef.current = fetcher.data;
    if (
      fetcher.data &&
      typeof fetcher.data === "object" &&
      "rawKey" in fetcher.data &&
      typeof fetcher.data.rawKey === "string"
    ) {
      onKeyCreated(fetcher.data.rawKey);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create API Key</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key for external system integration.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form method="POST" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="_action" value="create" />
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="e.g., Mobile App Integration" required />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional description" />
            </div>
            <div>
              <Label>Permissions</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {API_PERMISSIONS.map((perm) => (
                  <label key={perm.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox name="permissions" value={perm.value} />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="rateLimitTier">Rate Limit Tier</Label>
              <NativeSelect
                id="rateLimitTier"
                name="rateLimitTier"
                defaultValue="STANDARD"
                className="mt-1"
              >
                {RATE_LIMIT_TIERS.map((tier) => (
                  <NativeSelectOption key={tier.value} value={tier.value}>
                    {tier.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="expiresIn">Expires In (days)</Label>
              <Input
                id="expiresIn"
                name="expiresIn"
                type="number"
                placeholder="Leave empty for no expiry"
              />
            </div>
            <div>
              <Label htmlFor="allowedIps">Allowed IPs (comma-separated)</Label>
              <Input id="allowedIps" name="allowedIps" placeholder="Leave empty to allow all IPs" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? "Creating..." : "Create Key"}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeyRow({ apiKey, onKeyRotated }: { apiKey: any; onKeyRotated: (key: string) => void }) {
  const revokeFetcher = useFetcher();
  const rotateFetcher = useFetcher<typeof action>();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const prevRotateDataRef = useRef(rotateFetcher.data);

  // Surface rotated key to parent
  if (rotateFetcher.data !== prevRotateDataRef.current) {
    prevRotateDataRef.current = rotateFetcher.data;
    if (
      rotateFetcher.data &&
      typeof rotateFetcher.data === "object" &&
      "rawKey" in rotateFetcher.data &&
      typeof rotateFetcher.data.rawKey === "string"
    ) {
      onKeyRotated(rotateFetcher.data.rawKey);
    }
  }

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    ROTATED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    REVOKED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    EXPIRED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <div className="flex items-center justify-between py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{apiKey.name}</span>
          <Badge variant="outline">
            <code className="text-xs">{apiKey.keyPrefix}...</code>
          </Badge>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[apiKey.status] ?? ""}`}
          >
            {apiKey.status}
          </span>
          <Badge variant="secondary">{apiKey.rateLimitTier}</Badge>
        </div>
        {apiKey.description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{apiKey.description}</p>
        )}
        <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
          <span>
            Last used:{" "}
            {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : "Never"}
          </span>
          <span>Usage: {apiKey.usageCount}</span>
          {apiKey.expiresAt && (
            <span>Expires: {new Date(apiKey.expiresAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      <div className="ml-4 flex shrink-0 gap-2">
        {apiKey.status === "ACTIVE" && (
          <>
            {/* Rotate confirmation */}
            <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
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
                      rotateFetcher.submit(
                        { _action: "rotate", id: apiKey.id, graceHours: "24" },
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

            {/* Revoke confirmation */}
            <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Revoke
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Revoke API Key</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. The API key will be immediately disabled and all
                    requests using it will fail.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      revokeFetcher.submit(
                        { _action: "revoke", id: apiKey.id },
                        { method: "POST" },
                      );
                      setRevokeOpen(false);
                    }}
                  >
                    Revoke Key
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
}
