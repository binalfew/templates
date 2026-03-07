import { data, redirect, useActionData, useLoaderData } from "react-router";
import { useForm, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Edit Language" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { getLanguage, updateLanguage } from "~/services/reference-data.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { updateLanguageSchema } from "~/utils/schemas/reference-data";
import { Input } from "~/components/ui/input";
import { Field } from "~/components/ui/field";
import { ReferenceDataForm } from "~/components/reference-data/reference-data-form";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/utils/request-context.server";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAnyRole(request, [...ADMIN_ONLY]);
  const language = await getLanguage(params.languageId);
  return { language };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_ONLY]);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: updateLanguageSchema });
  if (submission.status !== "success") return data({ result: submission.reply() }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await updateLanguage(params.languageId, submission.value, ctx);
    return redirect(`/${params.tenant}/data/references/languages`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function EditLanguagePage() {
  const { language } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    defaultValue: {
      code: language.code,
      name: language.name,
      nativeName: language.nativeName ?? "",
      sortOrder: String(language.sortOrder),
      isActive: String(language.isActive),
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: updateLanguageSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Language</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update language details.</p>
      </div>
      <ReferenceDataForm
        form={form}
        fields={fields}
        title="Language Details"
        submitLabel="Save Changes"
        cancelUrl={`${basePrefix}/data/references/languages`}
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
