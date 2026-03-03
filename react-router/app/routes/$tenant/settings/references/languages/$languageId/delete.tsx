import { redirect, useLoaderData, useActionData, Form, Link } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Delete Language" };

import { requireUser } from "~/lib/session.server";
import { getLanguage, deleteLanguage } from "~/services/reference-data.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const language = await getLanguage(params.languageId);
  return { language };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteLanguage(params.languageId, ctx);
    return redirect(`/${params.tenant}/settings/references/languages`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteLanguagePage() {
  const { language } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Language</h2>
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
            {language.name} ({language.code})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Code</span>
              <p className="text-muted-foreground">{language.code}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Name</span>
              <p className="text-muted-foreground">{language.name}</p>
            </div>
            {language.nativeName && (
              <div>
                <span className="font-medium text-foreground">Native Name</span>
                <p className="text-muted-foreground">{language.nativeName}</p>
              </div>
            )}
          </div>

          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This action cannot be undone. The language will be permanently removed.
          </div>

          <div className="flex gap-3 pt-2">
            <Form method="post">
              <Button type="submit" variant="destructive">
                Delete Language
              </Button>
            </Form>
            <Button variant="outline" asChild>
              <Link to={`${basePrefix}/settings/references/languages`}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
