import { data, redirect, useActionData, useLoaderData } from "react-router";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Edit Title" };

import { requireUser } from "~/lib/auth/session.server";
import { getTitle, updateTitle } from "~/services/reference-data.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { updateTitleSchema } from "~/lib/schemas/reference-data";
import { ReferenceDataForm } from "~/components/reference-data/reference-data-form";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const title = await getTitle(params.titleId);
  return { title };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: updateTitleSchema });
  if (submission.status !== "success") return data({ result: submission.reply() }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await updateTitle(params.titleId, submission.value, ctx);
    return redirect(`/${params.tenant}/data/references/titles`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function EditTitlePage() {
  const { title } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    defaultValue: {
      code: title.code,
      name: title.name,
      sortOrder: String(title.sortOrder),
      isActive: String(title.isActive),
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: updateTitleSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Title</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update title details.</p>
      </div>
      <ReferenceDataForm
        form={form}
        fields={fields}
        title="Title Details"
        submitLabel="Save Changes"
        cancelUrl={`${basePrefix}/data/references/titles`}
      />
    </div>
  );
}
