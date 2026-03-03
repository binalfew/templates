import { data, redirect, useActionData, Form, Link, useSearchParams } from "react-router";

export const handle = { breadcrumb: "New View" };

import { requireFeature } from "~/lib/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { createView } from "~/services/saved-views.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { Checkbox } from "~/components/ui/checkbox";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/new";

export async function loader({ request }: Route.LoaderArgs) {
  await requireFeature(request, FEATURE_FLAG_KEYS.SAVED_VIEWS);
  return {};
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.SAVED_VIEWS);

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const entityType = formData.get("entityType") as string;
  const viewType = (formData.get("viewType") as string) || "TABLE";
  const isShared = formData.get("isShared") === "on";

  if (!name || !entityType) {
    return data({ error: "Name and entity type are required" }, { status: 400 });
  }

  try {
    await createView({
      tenantId,
      userId: user.id,
      name,
      entityType,
      viewType: viewType as "TABLE" | "KANBAN" | "CALENDAR" | "GALLERY",
      isShared,
    });
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/views`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function NewViewPage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/views`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create View</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new custom view for your data.
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
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Active Users"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field fieldId="entityType" label="Entity Type" required>
                <NativeSelect id="entityType" name="entityType">
                  <NativeSelectOption value="User">User</NativeSelectOption>
                  <NativeSelectOption value="Role">Role</NativeSelectOption>
                  <NativeSelectOption value="Permission">Permission</NativeSelectOption>
                  <NativeSelectOption value="AuditLog">Audit Log</NativeSelectOption>
                </NativeSelect>
              </Field>

              <Field fieldId="viewType" label="View Type" required>
                <NativeSelect id="viewType" name="viewType">
                  <NativeSelectOption value="TABLE">Table</NativeSelectOption>
                  <NativeSelectOption value="KANBAN">Kanban</NativeSelectOption>
                  <NativeSelectOption value="CALENDAR">Calendar</NativeSelectOption>
                  <NativeSelectOption value="GALLERY">Gallery</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="isShared" name="isShared" value="on" />
              <label htmlFor="isShared" className="text-sm text-foreground">
                Share this view with other users in the organization
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit">Create View</Button>
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
