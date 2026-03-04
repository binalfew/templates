import { redirect, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";

export const handle = { breadcrumb: "Delete Form" };

import { requireRoleAndFeature } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { getSectionTemplate, deleteSectionTemplate } from "~/services/section-templates.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.FORM_DESIGNER);
  const template = await getSectionTemplate(params.templateId, tenantId);
  return { template };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.FORM_DESIGNER);

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteSectionTemplate(params.templateId, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/settings/forms`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteFormPage() {
  const { template } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/settings/forms`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Form Template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this form template.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{template.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="font-medium text-foreground">Name</span>
              <p className="text-muted-foreground">{template.name}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Created</span>
              <p className="text-muted-foreground">
                {new Date(template.createdAt).toLocaleDateString()}
              </p>
            </div>
            {template.description && (
              <div className="col-span-full">
                <span className="font-medium text-foreground">Description</span>
                <p className="text-muted-foreground">{template.description}</p>
              </div>
            )}
          </div>

          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This action cannot be undone. The form template will be permanently deactivated.
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Form method="post">
              <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                Delete Template
              </Button>
            </Form>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to={cancelUrl}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
