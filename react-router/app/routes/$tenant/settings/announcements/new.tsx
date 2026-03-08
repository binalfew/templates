import { data, redirect, useActionData, Form, Link } from "react-router";
import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "New Announcement" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { createAnnouncement } from "~/services/announcements.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { buildServiceContext } from "~/utils/request-context.server";
import { createAnnouncementSchema } from "~/utils/schemas/announcement";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { DateTimePicker } from "~/components/ui/date-time-picker";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import type { Route } from "./+types/new";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  return {};
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  const tenantId = user.tenantId;
  if (!tenantId) return data({ result: { status: "error" as const, error: { "": ["No tenant"] } } }, { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createAnnouncementSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const { title, message, type, active, dismissible, startsAt, endsAt } = submission.value;
  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await createAnnouncement(
      {
        title,
        message,
        type,
        active,
        dismissible,
        startsAt: startsAt ? new Date(startsAt) : undefined,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
      ctx,
    );
    return redirect(`/${params.tenant}/settings/announcements`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewAnnouncementPage() {
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createAnnouncementSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Announcement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new announcement banner to display to users.
        </p>
      </div>

      <Form method="post" {...getFormProps(form)} className="space-y-6">
        {form.errors && form.errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {form.errors.map((error, i) => (
              <p key={i}>{error}</p>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Announcement Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field fieldId={fields.title.id} label="Title" required errors={fields.title.errors}>
                <Input
                  {...getInputProps(fields.title, { type: "text" })}
                  key={fields.title.key}
                  placeholder="Announcement title"
                  className="w-full"
                />
              </Field>
              <Field fieldId={fields.type.id} label="Type" errors={fields.type.errors}>
                <NativeSelect
                  id={fields.type.id}
                  name={fields.type.name}
                  key={fields.type.key}
                  defaultValue={fields.type.initialValue}
                  className="w-full"
                >
                  <NativeSelectOption value="INFO">Info</NativeSelectOption>
                  <NativeSelectOption value="WARNING">Warning</NativeSelectOption>
                  <NativeSelectOption value="CRITICAL">Critical</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
            <Field fieldId={fields.message.id} label="Message" required errors={fields.message.errors}>
              <textarea
                id={fields.message.id}
                name={fields.message.name}
                key={fields.message.key}
                defaultValue={fields.message.initialValue}
                placeholder="Announcement message"
                rows={3}
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule & Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field fieldId={fields.startsAt.id} label="Starts At" errors={fields.startsAt.errors}>
                <DateTimePicker name={fields.startsAt.name} placeholder="Pick start date & time" />
              </Field>
              <Field fieldId={fields.endsAt.id} label="Ends At (optional)" errors={fields.endsAt.errors}>
                <DateTimePicker name={fields.endsAt.name} placeholder="Pick end date & time" />
              </Field>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox name={fields.active.name} defaultChecked />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox name={fields.dismissible.name} defaultChecked />
                Dismissible
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto">
            Create Announcement
          </Button>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/announcements`}>Cancel</Link>
          </Button>
        </div>
      </Form>
    </div>
  );
}
