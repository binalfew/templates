import { data, redirect, useActionData } from "react-router";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "New Title" };

import { requireAnyRole } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { createTitle } from "~/services/reference-data.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { createTitleSchema } from "~/lib/schemas/reference-data";
import { ReferenceDataForm } from "~/components/reference-data/reference-data-form";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/new";

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_ONLY]);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createTitleSchema });
  if (submission.status !== "success") return data({ result: submission.reply() }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await createTitle(submission.value, ctx);
    return redirect(`/${params.tenant}/data/references/titles`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewTitlePage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createTitleSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Title</h2>
        <p className="mt-1 text-sm text-muted-foreground">Add a new title to the reference data.</p>
      </div>
      <ReferenceDataForm
        form={form}
        fields={fields}
        title="Title Details"
        submitLabel="Create Title"
        cancelUrl={`${basePrefix}/data/references/titles`}
      />
    </div>
  );
}
