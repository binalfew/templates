import { data, redirect, useActionData } from "react-router";
import { useForm, getInputProps, getTextareaProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "New Document Type" };

import { requireUser } from "~/lib/auth/session.server";
import { createDocumentType } from "~/services/reference-data.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { createDocumentTypeSchema } from "~/lib/schemas/reference-data";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Field } from "~/components/ui/field";
import { ReferenceDataForm } from "~/components/reference-data/reference-data-form";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/new";

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, {
    schema: createDocumentTypeSchema,
  });
  if (submission.status !== "success") return data({ result: submission.reply() }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await createDocumentType(submission.value, ctx);
    return redirect(`/${params.tenant}/settings/references/document-types`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewDocumentTypePage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createDocumentTypeSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Document Type</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new document type to the reference data.
        </p>
      </div>
      <ReferenceDataForm
        form={form}
        fields={fields}
        title="Document Type Details"
        submitLabel="Create Document Type"
        cancelUrl={`${basePrefix}/settings/references/document-types`}
      >
        <Field fieldId={fields.category.id} label="Category" errors={fields.category.errors}>
          <Input
            {...getInputProps(fields.category, { type: "text" })}
            key={fields.category.key}
            placeholder="e.g. Identity, Travel, Accreditation"
          />
        </Field>
        <Field
          fieldId={fields.description.id}
          label="Description"
          errors={fields.description.errors}
        >
          <Textarea
            {...getTextareaProps(fields.description)}
            key={fields.description.key}
            placeholder="Describe this document type..."
            rows={3}
          />
        </Field>
      </ReferenceDataForm>
    </div>
  );
}
