import { data, redirect, useActionData, useLoaderData } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Edit Field" };

import { requirePermission, requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { prisma } from "~/lib/db/db.server";
import { updateField } from "~/services/fields.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { FieldForm } from "~/components/fields/FieldForm";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/$fieldId";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requirePermission(request, "custom-field", "manage");
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.CUSTOM_FIELDS);

  const { fieldId } = params;

  const field = await prisma.fieldDefinition.findFirst({
    where: { id: fieldId, tenantId },
  });
  if (!field) {
    throw data({ error: "Field not found" }, { status: 404 });
  }

  return { field };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "custom-field", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const { fieldId } = params;
  const formData = await request.formData();

  const configRaw = formData.get("config") as string;
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(configRaw || "{}");
  } catch {
    // ignore parse error, use empty config
  }

  const cleanConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined && value !== null && value !== "") {
      cleanConfig[key] = value;
    }
  }

  const entityType = (formData.get("entityType") as string) || "Generic";
  const dataType = formData.get("dataType") as string;

  const input = {
    name: formData.get("name") as string,
    label: formData.get("label") as string,
    description: (formData.get("description") as string) || undefined,
    entityType,
    dataType: dataType as "TEXT" | "LONG_TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "DATETIME" | "ENUM" | "MULTI_ENUM" | "EMAIL" | "URL" | "PHONE" | "FILE" | "IMAGE" | "REFERENCE" | "FORMULA" | "JSON",
    isRequired: formData.get("isRequired") === "true",
    isUnique: formData.get("isUnique") === "true",
    isSearchable: formData.get("isSearchable") === "true",
    isFilterable: formData.get("isFilterable") === "true",
    defaultValue: (formData.get("defaultValue") as string) || undefined,
    config: cleanConfig,
    validation: [] as Record<string, unknown>[],
  };

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await updateField(fieldId!, input, ctx);
    return redirect(`/${params.tenant}/settings/fields`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function EditFieldPage() {
  const { field } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Edit Field: {field.label}</h2>

      <FieldForm field={field} errors={actionData as { formErrors?: string[] } | undefined} />
    </div>
  );
}
