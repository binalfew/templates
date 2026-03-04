import { data, Link, useLoaderData, useFetcher } from "react-router";

export const handle = { breadcrumb: "Webhooks" };

import { requireRoleAndFeature } from "~/lib/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/lib/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import {
  listWebhookSubscriptions,
  pauseWebhookSubscription,
  resumeWebhookSubscription,
  testWebhookEndpoint,
} from "~/services/webhooks.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { buildServiceContext } from "~/lib/request-context.server";
import { DataTable } from "~/components/data-table/data-table";
import type {
  ColumnDef,
  FilterDef,
  PaginationMeta,
} from "~/components/data-table/data-table-types";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Badge } from "~/components/ui/badge";
import { Webhook, Plus, Pencil, Pause, Play, Zap, Trash2 } from "lucide-react";
import type { Route } from "./+types/index";

// --- Loader ---

export async function loader({ request }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.WEBHOOKS);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";
  const status = (url.searchParams.get("status") as any) || undefined;

  const result = await listWebhookSubscriptions(tenantId, {
    page,
    pageSize,
    search: q || undefined,
    status,
  });

  const totalCount = result.meta.total;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    webhooks: result.items,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
  };
}

// --- Action (fetcher-based status transitions) ---

export async function action({ request }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.WEBHOOKS);

  const formData = await request.formData();
  const _action = formData.get("_action") as string;
  const id = formData.get("id") as string;

  if (!id) return data({ error: "Subscription ID is required" }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    if (_action === "pause") {
      await pauseWebhookSubscription(id, ctx);
      return data({ success: true });
    }

    if (_action === "resume") {
      await resumeWebhookSubscription(id, ctx);
      return data({ success: true });
    }

    if (_action === "test") {
      const result = await testWebhookEndpoint(id, ctx);
      return data({ success: true, testResult: result });
    }

    return data({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return handleServiceError(error);
  }
}

// --- Component ---

type WebhookRow = Awaited<ReturnType<typeof loader>>["webhooks"][number];

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  DISABLED: "outline",
  SUSPENDED: "destructive",
};

export default function WebhooksIndexPage() {
  const { webhooks, pagination } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const fetcher = useFetcher<typeof action>();

  const columns: ColumnDef<WebhookRow>[] = [
    {
      id: "url",
      header: "URL",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Webhook className="size-4 text-muted-foreground shrink-0" />
          <Link
            to={`${base}/settings/webhooks/${row.id}`}
            className="hover:underline truncate max-w-xs"
          >
            {row.url}
          </Link>
        </div>
      ),
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "events",
      header: "Events",
      cell: (row) => (
        <Badge variant="secondary">
          {row.events.includes("*") ? "All" : `${row.events.length}`}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? "secondary"}>
          {row.status}
        </Badge>
      ),
    },
    {
      id: "failures",
      header: "Failures",
      cell: (row) => (
        <span className={row.consecutiveFailures > 0 ? "text-destructive" : "text-muted-foreground"}>
          {row.consecutiveFailures}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      id: "createdAt",
      header: "Created",
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
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
        { label: "Paused", value: "PAUSED" },
        { label: "Disabled", value: "DISABLED" },
        { label: "Suspended", value: "SUSPENDED" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <DataTable
        data={webhooks}
        columns={columns}
        searchConfig={{ placeholder: "Search webhooks..." }}
        filters={filters}
        toolbarActions={[
          { label: "New Webhook", icon: Plus, href: `${base}/settings/webhooks/new` },
        ]}
        rowActions={[
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/settings/webhooks/${row.id}/edit`,
            visible: (row) => row.status === "ACTIVE" || row.status === "PAUSED",
          },
          {
            label: "Pause",
            icon: Pause,
            onClick: (row) => {
              fetcher.submit({ _action: "pause", id: row.id }, { method: "POST" });
            },
            visible: (row) => row.status === "ACTIVE",
          },
          {
            label: "Resume",
            icon: Play,
            onClick: (row) => {
              fetcher.submit({ _action: "resume", id: row.id }, { method: "POST" });
            },
            visible: (row) => row.status === "PAUSED",
          },
          {
            label: "Test",
            icon: Zap,
            onClick: (row) => {
              fetcher.submit({ _action: "test", id: row.id }, { method: "POST" });
            },
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/settings/webhooks/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Webhook,
          title: "No webhooks found",
          description:
            "Webhook subscriptions will appear here once created. Create one to receive real-time event notifications.",
        }}
      />
    </div>
  );
}
