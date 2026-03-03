import { data, redirect, useActionData } from "react-router";
import { useForm, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "New Currency" };

import { requireUser } from "~/lib/auth/session.server";
import { createCurrency } from "~/services/reference-data.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { createCurrencySchema } from "~/lib/schemas/reference-data";
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
  const submission = parseWithZod(formData, { schema: createCurrencySchema });
  if (submission.status !== "success") return data({ result: submission.reply() }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await createCurrency(submission.value, ctx);
    return redirect(`/${params.tenant}/settings/references/currencies`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewCurrencyPage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createCurrencySchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Currency</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new currency to the reference data.
        </p>
      </div>
      <ReferenceDataForm
        form={form}
        fields={fields}
        title="Currency Details"
        submitLabel="Create Currency"
        cancelUrl={`${basePrefix}/settings/references/currencies`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field fieldId={fields.symbol.id} label="Symbol" errors={fields.symbol.errors}>
            <Input
              {...getInputProps(fields.symbol, { type: "text" })}
              key={fields.symbol.key}
              placeholder="e.g. $"
            />
          </Field>
          <Field
            fieldId={fields.decimalDigits.id}
            label="Decimal Digits"
            errors={fields.decimalDigits.errors}
          >
            <Input
              {...getInputProps(fields.decimalDigits, { type: "number" })}
              key={fields.decimalDigits.key}
              placeholder="2"
            />
          </Field>
        </div>
      </ReferenceDataForm>
    </div>
  );
}
