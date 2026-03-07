import { redirect, useLoaderData, useActionData, Form, Link } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Delete Title" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { getTitle, deleteTitle } from "~/services/reference-data.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/utils/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAnyRole(request, [...ADMIN_ONLY]);
  const title = await getTitle(params.titleId);
  return { title };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_ONLY]);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteTitle(params.titleId, ctx);
    return redirect(`/${params.tenant}/data/references/titles`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteTitlePage() {
  const { title } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Title</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {title.name} ({title.code})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Code</span>
              <p className="text-muted-foreground">{title.code}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Name</span>
              <p className="text-muted-foreground">{title.name}</p>
            </div>
          </div>

          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This action cannot be undone. The title will be permanently removed.
          </div>

          <div className="flex gap-3 pt-2">
            <Form method="post">
              <Button type="submit" variant="destructive">
                Delete Title
              </Button>
            </Form>
            <Button variant="outline" asChild>
              <Link to={`${basePrefix}/data/references/titles`}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
