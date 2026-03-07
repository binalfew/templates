import { data, Link, useLoaderData, useFetcher } from "react-router";

export const handle = { breadcrumb: "API Keys" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { listApiKeys, revokeApiKey } from "~/services/api-keys.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { buildServiceContext } from "~/utils/request-context.server";
import { DataTable } from "~/components/data-table/data-table";
import type {
  ColumnDef,
  FilterDef,
  PaginationMeta,
} from "~/components/data-table/data-table-types";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Badge } from "~/components/ui/badge";
import { Key, Plus, Trash2 } from "lucide-react";
import { API_KEY_STATUS_VARIANTS } from "./shared";
import type { Route } from "./+types/index";

// --- Loader ---

export async function loader({ request }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.REST_API);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";
  const status =
    (url.searchParams.get("status") as "ACTIVE" | "ROTATED" | "REVOKED" | "EXPIRED") || undefined;

  const result = await listApiKeys(tenantId, {
    page,
    pageSize,
    search: q || undefined,
    status,
  });

  return {
    apiKeys: result.items,
    pagination: {
      page,
      pageSize,
      totalCount: result.meta.total,
      totalPages: result.meta.totalPages,
    } satisfies PaginationMeta,
  };
}

// --- Action (fetcher-based revoke) ---

export async function action({ request }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.REST_API);

  const formData = await request.formData();
  const _action = formData.get("_action") as string;
  const id = formData.get("id") as string;

  if (!id) return data({ error: "Key ID is required" }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    if (_action === "revoke") {
      await revokeApiKey(id, ctx);
      return data({ success: true });
    }

    return data({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return handleServiceError(error);
  }
}

// --- Component ---

type ApiKeyRow = Awaited<ReturnType<typeof loader>>["apiKeys"][number];

export default function ApiKeysIndexPage() {
  const { apiKeys, pagination } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const fetcher = useFetcher<typeof action>();

  const columns: ColumnDef<ApiKeyRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Key className="size-4 text-muted-foreground shrink-0" />
          <Link
            to={`${base}/settings/api-keys/${row.id}`}
            className="hover:underline truncate max-w-xs"
          >
            {row.name}
          </Link>
        </div>
      ),
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "keyPrefix",
      header: "Key Prefix",
      cell: (row) => (
        <Badge variant="outline">
          <code className="text-xs">{row.keyPrefix}...</code>
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={API_KEY_STATUS_VARIANTS[row.status] ?? "secondary"}>{row.status}</Badge>
      ),
    },
    {
      id: "rateLimitTier",
      header: "Rate Limit",
      cell: (row) => <Badge variant="secondary">{row.rateLimitTier}</Badge>,
      hideOnMobile: true,
    },
    {
      id: "lastUsedAt",
      header: "Last Used",
      cell: (row) =>
        row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleDateString() : "Never",
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
    {
      id: "usageCount",
      header: "Usage",
      cell: (row) => row.usageCount,
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
  ];

  const filters: FilterDef[] = [
    {
      paramKey: "status",
      label: "Status",
      placeholder: "All statuses",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Rotated", value: "ROTATED" },
        { label: "Revoked", value: "REVOKED" },
        { label: "Expired", value: "EXPIRED" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <DataTable
        data={apiKeys}
        columns={columns}
        searchConfig={{ placeholder: "Search API keys..." }}
        filters={filters}
        toolbarActions={[
          { label: "Create API Key", icon: Plus, href: `${base}/settings/api-keys/new` },
        ]}
        rowActions={[
          {
            label: "Revoke",
            icon: Trash2,
            onClick: (row) => {
              fetcher.submit({ _action: "revoke", id: row.id }, { method: "POST" });
            },
            variant: "destructive",
            visible: (row) => row.status === "ACTIVE",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Key,
          title: "No API keys found",
          description:
            "API keys will appear here once created. Create one to get started with the REST API.",
        }}
      />
    </div>
  );
}
