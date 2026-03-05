import { data, redirect, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";
export const handle = { breadcrumb: "Edit View" };

import { requireRoleAndFeature } from "~/lib/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/lib/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { getView, updateView } from "~/services/saved-views.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { Checkbox } from "~/components/ui/checkbox";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.SAVED_VIEWS);

  const view = await getView(params.viewId, tenantId);
  if (view.userId !== user.id) {
    throw data({ error: "You can only edit your own views" }, { status: 403 });
  }

  return { view };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.SAVED_VIEWS);

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const viewType = formData.get("viewType") as string;
  const isShared = formData.get("isShared") === "on";
  const isDefault = formData.get("isDefault") === "on";

  if (!name) {
    return data({ error: "Name is required" }, { status: 400 });
  }

  try {
    await updateView(params.viewId, user.id, tenantId, {
      name,
      viewType: viewType as "TABLE" | "KANBAN" | "CALENDAR" | "GALLERY",
      isShared,
      isDefault,
    });
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/settings/views`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function EditViewPage() {
  const { view } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/settings/views`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit View</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update settings for the <strong>{view.name}</strong> view.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            {actionData && "error" in actionData && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {(actionData as { error: string }).error}
              </div>
            )}

            <Field fieldId="name" label="View Name" required>
              <Input id="name" name="name" required defaultValue={view.name} />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field fieldId="entityType" label="Entity Type">
                <Input id="entityType" value={view.entityType} disabled />
              </Field>

              <Field fieldId="viewType" label="View Type" required>
                <NativeSelect id="viewType" name="viewType" defaultValue={view.viewType}>
                  <NativeSelectOption value="TABLE">Table</NativeSelectOption>
                  <NativeSelectOption value="KANBAN">Kanban</NativeSelectOption>
                  <NativeSelectOption value="CALENDAR">Calendar</NativeSelectOption>
                  <NativeSelectOption value="GALLERY">Gallery</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isDefault"
                  name="isDefault"
                  value="on"
                  defaultChecked={view.isDefault}
                />
                <label htmlFor="isDefault" className="text-sm text-foreground">
                  Set as default view for this entity type
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isShared"
                  name="isShared"
                  value="on"
                  defaultChecked={view.isShared}
                />
                <label htmlFor="isShared" className="text-sm text-foreground">
                  Share this view with other users in the organization
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit">Save Changes</Button>
              <Button type="button" variant="outline" asChild>
                <Link to={cancelUrl}>Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
