import { data, Link, redirect, useLoaderData } from "react-router";
import { Columns3, Pencil, Plus, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Fields" };

import { requireRoleAndFeature } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import {
  listFields,
  listFieldsPaginated,
  deleteField,
  reorderFields,
} from "~/services/fields.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { formatDataType } from "~/components/fields/+utils";
import { FIELD_DATA_TYPES } from "~/lib/schemas/field";
import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, FilterDef, PaginationMeta } from "~/components/data-table/data-table-types";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/index";

export async function loader({ request }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_FIELDS);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const dataType = url.searchParams.get("dataType") || undefined;
  const q = url.searchParams.get("q")?.trim() || "";

  const { items: fields, totalCount } = await listFieldsPaginated(tenantId, {
    dataType,
    search: q || undefined,
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    fields,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_FIELDS);

  const formData = await request.formData();
  const _action = formData.get("_action");

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    if (_action === "delete") {
      const fieldId = formData.get("fieldId") as string;
      const force = formData.get("force") === "true";
      await deleteField(fieldId, ctx, { force });
      return redirect(`/${params.tenant}/settings/fields`);
    }

    if (_action === "reorder") {
      const fieldId = formData.get("fieldId") as string;
      const direction = formData.get("direction") as "up" | "down";

      const fields = await listFields(tenantId);
      const currentIndex = fields.findIndex((f) => f.id === fieldId);
      if (currentIndex === -1) {
        return data({ error: "Field not found" }, { status: 404 });
      }

      const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= fields.length) {
        return data({ error: "Cannot move further" }, { status: 400 });
      }

      const fieldIds = fields.map((f) => f.id);
      [fieldIds[currentIndex], fieldIds[swapIndex]] = [fieldIds[swapIndex], fieldIds[currentIndex]];

      await reorderFields({ fieldIds }, ctx);
      return redirect(`/${params.tenant}/settings/fields`);
    }

    return data({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return handleServiceError(error);
  }
}

type FieldRow = Awaited<ReturnType<typeof loader>>["fields"][number];

export default function FieldsListPage() {
  const { fields, pagination } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const columns: ColumnDef<FieldRow>[] = [
    {
      id: "label",
      header: "Label",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Columns3 className="size-4 text-muted-foreground shrink-0" />
          <Link to={`${base}/settings/fields/${row.id}`} className="hover:underline">
            {row.label}
          </Link>
        </div>
      ),
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "name",
      header: "Name",
      cell: "name",
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
    {
      id: "dataType",
      header: "Type",
      cell: (row) => <Badge variant="secondary">{formatDataType(row.dataType)}</Badge>,
    },
    {
      id: "entityType",
      header: "Entity",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.entityType}</span>,
      hideOnMobile: true,
    },
    {
      id: "isRequired",
      header: "Required",
      align: "center",
      cell: (row) =>
        row.isRequired ? (
          <span className="text-green-600">&#10003;</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
    },
    {
      id: "isSearchable",
      header: "Searchable",
      align: "center",
      cell: (row) =>
        row.isSearchable ? (
          <span className="text-green-600">&#10003;</span>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        ),
      hideOnMobile: true,
    },
  ];

  const filters: FilterDef[] = [
    {
      paramKey: "dataType",
      label: "Data Type",
      placeholder: "All types",
      options: FIELD_DATA_TYPES.map((dt) => ({
        label: dt.replace(/_/g, " "),
        value: dt,
      })),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Fields</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define custom fields for your entities.
        </p>
      </div>

      <DataTable
        data={fields}
        columns={columns}
        searchConfig={{ placeholder: "Search fields..." }}
        filters={filters}
        toolbarActions={[
          { label: "Add Field", icon: Plus, href: `${base}/settings/fields/new` },
        ]}
        rowActions={[
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/settings/fields/${row.id}/edit`,
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/settings/fields/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Columns3,
          title: "No fields found",
          description: "Custom fields will appear here once they are created.",
        }}
      />
    </div>
  );
}
