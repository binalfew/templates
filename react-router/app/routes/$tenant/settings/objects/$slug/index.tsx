import { data, useLoaderData, Link } from "react-router";
import { Plus, Pencil, Trash2, Database, ArrowLeft, Settings } from "lucide-react";
import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import {
  getDefinitionBySlug,
  listRecordsPaginated,
  deleteRecord,
  type CustomFieldDefinition,
} from "~/services/custom-objects.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta } from "~/components/data-table/data-table-types";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Records" };

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const definition = await getDefinitionBySlug(tenantId, params.slug!);
  const fields = (definition.fields as unknown as CustomFieldDefinition[]) ?? [];

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";

  // Search across TEXT-type fields in the JSON data column
  const textFields = fields.filter((f) => f.dataType === "TEXT" || f.dataType === "EMAIL" || f.dataType === "URL");
  const searchWhere = q && textFields.length > 0
    ? {
        OR: textFields.map((f) => ({
          data: { path: [f.name], string_contains: q, mode: "insensitive" as const },
        })),
      }
    : {};

  const combinedWhere = Object.keys(searchWhere).length > 0 ? searchWhere : {};

  const { items: records, totalCount } = await listRecordsPaginated(definition.id, tenantId, {
    where: combinedWhere,
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    definition,
    fields,
    records,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  try {
    if (_action === "delete-record") {
      await deleteRecord(formData.get("recordId") as string, tenantId);
      return data({ success: true });
    }
    return data({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return handleServiceError(error);
  }
}

type RecordRow = Awaited<ReturnType<typeof loader>>["records"][number];

export default function CustomObjectRecordsPage() {
  const { definition, fields, records, pagination } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const slug = definition.slug;

  const columns: ColumnDef<RecordRow>[] = fields.map((field, index) => ({
    id: field.name,
    header: field.label,
    hideOnMobile: index >= 4,
    cell: (row: RecordRow) => {
      const recordData = row.data as Record<string, unknown>;
      const value = recordData[field.name];
      if (field.dataType === "BOOLEAN") return value === true ? "Yes" : "No";
      if (field.dataType === "DATE" && value) {
        return new Date(value as string).toLocaleDateString();
      }
      return String(value ?? "\u2014");
    },
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link to={`${base}/settings/objects`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 size-4" /> Back
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{definition.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {definition.description || definition.slug}
          </p>
        </div>
      </div>

      {fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fields.map((f) => (
            <Badge key={f.name} variant="secondary">
              {f.label} ({f.dataType}){f.required ? " *" : ""}
            </Badge>
          ))}
        </div>
      )}

      <Separator />

      <DataTable
        data={records}
        columns={columns}
        searchConfig={{ placeholder: "Search records..." }}
        toolbarActions={[
          { label: "New Record", icon: Plus, href: `${base}/settings/objects/${slug}/new` },
          { label: "Add Field", icon: Settings, href: `${base}/settings/objects/${slug}/add-field`, variant: "outline" },
        ]}
        rowActions={[
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/settings/objects/${slug}/${row.id}/edit`,
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/settings/objects/${slug}/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Database,
          title: "No records",
          description: fields.length > 0
            ? "Create records using the button above."
            : "Add fields to the schema first, then create records.",
        }}
      />
    </div>
  );
}
