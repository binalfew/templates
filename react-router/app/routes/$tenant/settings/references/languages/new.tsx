import { data, redirect, useActionData } from "react-router";
import { useForm, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "New Language" };

import { requireUser } from "~/lib/auth/session.server";
import { createLanguage } from "~/services/reference-data.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { createLanguageSchema } from "~/lib/schemas/reference-data";
import { Input } from "~/components/ui/input";
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
  const submission = parseWithZod(formData, { schema: createLanguageSchema });
  if (submission.status !== "success") return data({ result: submission.reply() }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await createLanguage(submission.value, ctx);
    return redirect(`/${params.tenant}/settings/references/languages`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewLanguagePage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createLanguageSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Language</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new language to the reference data.
        </p>
      </div>
      <ReferenceDataForm
        form={form}
        fields={fields}
        title="Language Details"
        submitLabel="Create Language"
        cancelUrl={`${basePrefix}/settings/references/languages`}
      >
        <Field fieldId={fields.nativeName.id} label="Native Name" errors={fields.nativeName.errors}>
          <Input
            {...getInputProps(fields.nativeName, { type: "text" })}
            key={fields.nativeName.key}
            placeholder="e.g. Fran\u00e7ais"
          />
        </Field>
      </ReferenceDataForm>
    </div>
  );
}
