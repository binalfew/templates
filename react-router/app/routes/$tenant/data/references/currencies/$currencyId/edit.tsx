import { data, redirect, useActionData, useLoaderData } from "react-router";
import { useForm, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Edit Currency" };

import { requireAnyRole } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { getCurrency, updateCurrency } from "~/services/reference-data.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { updateCurrencySchema } from "~/lib/schemas/reference-data";
import { Input } from "~/components/ui/input";
import { Field } from "~/components/ui/field";
import { ReferenceDataForm } from "~/components/reference-data/reference-data-form";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAnyRole(request, [...ADMIN_ONLY]);
  const currency = await getCurrency(params.currencyId);
  return { currency };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_ONLY]);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: updateCurrencySchema });
  if (submission.status !== "success") return data({ result: submission.reply() }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await updateCurrency(params.currencyId, submission.value, ctx);
    return redirect(`/${params.tenant}/data/references/currencies`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function EditCurrencyPage() {
  const { currency } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    defaultValue: {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol ?? "",
      decimalDigits: String(currency.decimalDigits),
      sortOrder: String(currency.sortOrder),
      isActive: String(currency.isActive),
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: updateCurrencySchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Currency</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update currency details.</p>
      </div>
      <ReferenceDataForm
        form={form}
        fields={fields}
        title="Currency Details"
        submitLabel="Save Changes"
        cancelUrl={`${basePrefix}/data/references/currencies`}
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
