import { data, Form, Link, redirect, useLoaderData, useSearchParams } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Fields" };

import { requirePermission, requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import {
  listFields,
  deleteField,
  reorderFields,
  getFieldDataCount,
} from "~/services/fields.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Separator } from "~/components/ui/separator";
import { FieldTable } from "~/components/fields/FieldTable";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/index";

const FIELD_DATA_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "ENUM",
  "MULTI_ENUM",
  "EMAIL",
  "URL",
  "PHONE",
  "FILE",
  "IMAGE",
  "REFERENCE",
  "FORMULA",
  "JSON",
] as const;

export async function loader({ request }: Route.LoaderArgs) {
  await requirePermission(request, "custom-field", "manage");
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.CUSTOM_FIELDS);

  const url = new URL(request.url);
  const dataType = url.searchParams.get("dataType") || undefined;

  const fields = await listFields(tenantId, {
    dataType,
  });

  const dataCounts: Record<string, number> = {};
  for (const field of fields) {
    dataCounts[field.id] = await getFieldDataCount(field.id, tenantId);
  }

  return { fields, dataCounts };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "custom-field", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

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

export default function FieldsListPage() {
  const { fields, dataCounts } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const basePrefix = useBasePrefix();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Fields</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define custom fields for your entities. {fields.length} field
            {fields.length !== 1 ? "s" : ""} defined.
          </p>
        </div>
        <Link to={`${basePrefix}/settings/fields/new`}>
          <Button>Add Field</Button>
        </Link>
      </div>

      <Separator />

      <Form method="get" className="flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor="dataType"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            Data Type
          </label>
          <NativeSelect
            id="dataType"
            name="dataType"
            defaultValue={searchParams.get("dataType") ?? ""}
          >
            <NativeSelectOption value="">All types</NativeSelectOption>
            {FIELD_DATA_TYPES.map((dt) => (
              <NativeSelectOption key={dt} value={dt}>
                {dt.replace(/_/g, " ")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
        {searchParams.get("dataType") && (
          <Link
            to={`${basePrefix}/settings/fields`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Link>
        )}
      </Form>

      <div className="rounded-lg border bg-card">
        <FieldTable fields={fields} dataCounts={dataCounts} />
      </div>
    </div>
  );
}
