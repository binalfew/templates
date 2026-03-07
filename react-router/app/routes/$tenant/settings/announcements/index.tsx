import { Link, useLoaderData } from "react-router";

export const handle = { breadcrumb: "Announcements" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { listAnnouncements } from "~/services/announcements.server";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta } from "~/components/data-table/data-table-types";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Badge } from "~/components/ui/badge";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import type { Route } from "./+types/index";

// --- Loader ---

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  const tenantId = user.tenantId;
  if (!tenantId) throw new Response("No tenant", { status: 403 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";

  const result = await listAnnouncements(tenantId, {
    page,
    pageSize,
    search: q || undefined,
  });

  const totalCount = result.meta.total;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    announcements: result.items,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
  };
}

// --- Component ---

type AnnouncementRow = Awaited<ReturnType<typeof loader>>["announcements"][number];

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  INFO: "default",
  WARNING: "secondary",
  CRITICAL: "destructive",
};

export default function AnnouncementsIndexPage() {
  const { announcements, pagination } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const columns: ColumnDef<AnnouncementRow>[] = [
    {
      id: "title",
      header: "Title",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-muted-foreground shrink-0" />
          <Link
            to={`${base}/settings/announcements/${row.id}`}
            className="hover:underline truncate max-w-xs"
          >
            {row.title}
          </Link>
        </div>
      ),
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => (
        <Badge variant={TYPE_VARIANTS[row.type] ?? "secondary"}>{row.type}</Badge>
      ),
    },
    {
      id: "active",
      header: "Active",
      cell: (row) => (
        <Badge variant={row.active ? "default" : "outline"}>{row.active ? "Yes" : "No"}</Badge>
      ),
    },
    {
      id: "startsAt",
      header: "Starts At",
      cell: (row) => new Date(row.startsAt).toLocaleDateString(),
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
    {
      id: "endsAt",
      header: "Ends At",
      cell: (row) => (row.endsAt ? new Date(row.endsAt).toLocaleDateString() : "No end"),
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <DataTable
        data={announcements}
        columns={columns}
        searchConfig={{ placeholder: "Search announcements..." }}
        toolbarActions={[
          {
            label: "New Announcement",
            icon: Plus,
            href: `${base}/settings/announcements/new`,
          },
        ]}
        rowActions={[
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/settings/announcements/${row.id}/edit`,
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/settings/announcements/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Megaphone,
          title: "No announcements found",
          description:
            "Announcements will appear here once created. Create one to display banners to your users.",
        }}
      />
    </div>
  );
}
