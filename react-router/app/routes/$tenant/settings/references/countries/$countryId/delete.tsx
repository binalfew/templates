import { redirect, useLoaderData, useActionData, Form, Link } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Delete Country" };

import { requireUser } from "~/lib/session.server";
import { getCountry, deleteCountry } from "~/services/reference-data.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const country = await getCountry(params.countryId);
  return { country };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteCountry(params.countryId, ctx);
    return redirect(`/${params.tenant}/settings/references/countries`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteCountryPage() {
  const { country } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Country</h2>
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
            {country.flag} {country.name} ({country.code})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Code</span>
              <p className="text-muted-foreground">{country.code}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Name</span>
              <p className="text-muted-foreground">{country.name}</p>
            </div>
            {country.alpha3 && (
              <div>
                <span className="font-medium text-foreground">Alpha-3</span>
                <p className="text-muted-foreground">{country.alpha3}</p>
              </div>
            )}
            {country.phoneCode && (
              <div>
                <span className="font-medium text-foreground">Phone Code</span>
                <p className="text-muted-foreground">{country.phoneCode}</p>
              </div>
            )}
          </div>

          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This action cannot be undone. The country will be permanently removed.
          </div>

          <div className="flex gap-3 pt-2">
            <Form method="post">
              <Button type="submit" variant="destructive">
                Delete Country
              </Button>
            </Form>
            <Button variant="outline" asChild>
              <Link to={`${basePrefix}/settings/references/countries`}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
