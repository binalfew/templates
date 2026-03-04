import { data, redirect, useActionData, useLoaderData, Form } from "react-router";
import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { z } from "zod/v4";

import { requireAnyRole } from "~/lib/auth/require-auth.server";
import { resolveTenant } from "~/lib/tenant.server";
import { updateTenant } from "~/services/tenants.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { BrandingColorSection } from "~/components/branding-color-picker";
import { LogoUpload } from "~/components/logo-upload";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/organization";

export const handle = { breadcrumb: "Organization" };

const organizationSchema = z.object({
  name: z.string({ error: "Name is required" }).min(1, "Name is required").max(200),
  email: z.email("Valid email is required"),
  phone: z.string({ error: "Phone is required" }).min(1, "Phone is required"),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  logoUrl: z.string().optional(),
  brandTheme: z.string().optional(),
});

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAnyRole(request, ["ADMIN", "TENANT_ADMIN"]);
  const tenant = await resolveTenant(params.tenant);
  return { tenant };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, ["ADMIN", "TENANT_ADMIN"]);
  const tenant = await resolveTenant(params.tenant);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: organizationSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const ctx = buildServiceContext(request, user, tenant.id);

  try {
    await updateTenant(
      tenant.id,
      {
        ...submission.value,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscriptionPlan,
      },
      ctx,
    );
    return redirect(`/${params.tenant}/settings/organization`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function OrganizationSettingsPage() {
  const { tenant } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    defaultValue: {
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      website: tenant.website ?? "",
      address: tenant.address ?? "",
      city: tenant.city ?? "",
      state: tenant.state ?? "",
      zip: tenant.zip ?? "",
      country: tenant.country ?? "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: organizationSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Organization</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization's details and branding.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Update your organization's contact information and branding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)} className="space-y-4">
            {form.errors && form.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {form.errors.map((error, i) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            )}

            <Field
              fieldId={fields.name.id}
              label="Organization Name"
              required
              errors={fields.name.errors}
            >
              <Input {...getInputProps(fields.name, { type: "text" })} key={fields.name.key} />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field fieldId={fields.email.id} label="Email" required errors={fields.email.errors}>
                <Input {...getInputProps(fields.email, { type: "email" })} key={fields.email.key} />
              </Field>

              <Field fieldId={fields.phone.id} label="Phone" required errors={fields.phone.errors}>
                <Input {...getInputProps(fields.phone, { type: "tel" })} key={fields.phone.key} />
              </Field>
            </div>

            <Field fieldId={fields.website.id} label="Website" errors={fields.website.errors}>
              <Input
                {...getInputProps(fields.website, { type: "url" })}
                key={fields.website.key}
                placeholder="https://example.com"
              />
            </Field>

            <Field fieldId={fields.address.id} label="Address" errors={fields.address.errors}>
              <Input
                {...getInputProps(fields.address, { type: "text" })}
                key={fields.address.key}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field fieldId={fields.city.id} label="City" errors={fields.city.errors}>
                <Input {...getInputProps(fields.city, { type: "text" })} key={fields.city.key} />
              </Field>

              <Field fieldId={fields.state.id} label="State" errors={fields.state.errors}>
                <Input {...getInputProps(fields.state, { type: "text" })} key={fields.state.key} />
              </Field>

              <Field fieldId={fields.zip.id} label="ZIP" errors={fields.zip.errors}>
                <Input {...getInputProps(fields.zip, { type: "text" })} key={fields.zip.key} />
              </Field>

              <Field fieldId={fields.country.id} label="Country" errors={fields.country.errors}>
                <Input
                  {...getInputProps(fields.country, { type: "text" })}
                  key={fields.country.key}
                />
              </Field>
            </div>

            <LogoUpload initialLogoUrl={tenant.logoUrl} />

            <BrandingColorSection initialBrandTheme={tenant.brandTheme ?? ""} />

            <div className="flex gap-3 pt-4">
              <Button type="submit">Save Changes</Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
