import { data, redirect, useActionData } from "react-router";
import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "New Country" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { createCountry } from "~/services/reference-data.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { createCountrySchema } from "~/utils/schemas/reference-data";
import { Input } from "~/components/ui/input";
import { Field } from "~/components/ui/field";
import { ReferenceDataForm } from "~/components/reference-data/reference-data-form";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/utils/request-context.server";
import type { Route } from "./+types/new";

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_ONLY]);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createCountrySchema });
  if (submission.status !== "success") return data({ result: submission.reply() }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await createCountry(submission.value, ctx);
    return redirect(`/${params.tenant}/data/references/countries`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewCountryPage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createCountrySchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Country</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new country to the reference data.
        </p>
      </div>
      <ReferenceDataForm
        form={form}
        fields={fields}
        title="Country Details"
        submitLabel="Create Country"
        cancelUrl={`${basePrefix}/data/references/countries`}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field fieldId={fields.alpha3.id} label="Alpha-3 Code" errors={fields.alpha3.errors}>
            <Input
              {...getInputProps(fields.alpha3, { type: "text" })}
              key={fields.alpha3.key}
              placeholder="e.g. USA"
            />
          </Field>
          <Field
            fieldId={fields.numericCode.id}
            label="Numeric Code"
            errors={fields.numericCode.errors}
          >
            <Input
              {...getInputProps(fields.numericCode, { type: "text" })}
              key={fields.numericCode.key}
              placeholder="e.g. 840"
            />
          </Field>
          <Field fieldId={fields.phoneCode.id} label="Phone Code" errors={fields.phoneCode.errors}>
            <Input
              {...getInputProps(fields.phoneCode, { type: "text" })}
              key={fields.phoneCode.key}
              placeholder="e.g. +1"
            />
          </Field>
        </div>
        <Field fieldId={fields.flag.id} label="Flag Emoji" errors={fields.flag.errors}>
          <Input
            {...getInputProps(fields.flag, { type: "text" })}
            key={fields.flag.key}
            placeholder="e.g. \u{1F1FA}\u{1F1F8}"
          />
        </Field>
      </ReferenceDataForm>
    </div>
  );
}
