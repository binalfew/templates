import { data, redirect, useActionData, Form } from "react-router";
import { useForm, getFormProps, getInputProps, getSelectProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useState, useEffect, useRef } from "react";

export const handle = { breadcrumb: "New Tenant" };

import { requireAnyRole } from "~/lib/require-auth.server";
import { createTenant } from "~/services/tenants.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { createTenantSchema } from "~/lib/schemas/tenant";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { BrandingColorSection } from "~/components/branding-color-picker";
import { LogoUpload } from "~/components/logo-upload";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/new";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnyRole(request, ["ADMIN"]);
  return {};
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, ["ADMIN"]);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createTenantSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const ctx = buildServiceContext(request, user);

  try {
    await createTenant(submission.value, ctx);
    return redirect(`/${params.tenant}/tenants`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewTenantPage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const slugInputRef = useRef<HTMLInputElement>(null);

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createTenantSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const [slugPreview, setSlugPreview] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (slugManuallyEdited) return;
    const value = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const generated = slugify(value);
      setSlugPreview(generated);
      if (slugInputRef.current) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeInputValueSetter?.call(slugInputRef.current, generated);
        slugInputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, 300);
  }

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Tenant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new organization to the platform.
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

        {/* Section 1: Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field fieldId={fields.name.id} label="Name" required errors={fields.name.errors}>
              <Input
                {...getInputProps(fields.name, { type: "text" })}
                key={fields.name.key}
                placeholder="e.g. Acme Corporation"
                onChange={handleNameChange}
              />
            </Field>

            <Field fieldId={fields.slug.id} label="URL Slug" required errors={fields.slug.errors}>
              <Input
                {...getInputProps(fields.slug, { type: "text" })}
                key={fields.slug.key}
                ref={slugInputRef}
                placeholder="e.g. acme-corp"
                onChange={() => setSlugManuallyEdited(true)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL preview:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  https://app.example.com/{slugPreview || fields.slug.value || "slug"}
                </code>
              </p>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field fieldId={fields.email.id} label="Email" required errors={fields.email.errors}>
                <Input
                  {...getInputProps(fields.email, { type: "email" })}
                  key={fields.email.key}
                  placeholder="admin@example.com"
                />
              </Field>

              <Field fieldId={fields.phone.id} label="Phone" required errors={fields.phone.errors}>
                <Input
                  {...getInputProps(fields.phone, { type: "tel" })}
                  key={fields.phone.key}
                  placeholder="+1-000-000-0000"
                />
              </Field>
            </div>

            <Field fieldId={fields.website.id} label="Website" errors={fields.website.errors}>
              <Input
                {...getInputProps(fields.website, { type: "url" })}
                key={fields.website.key}
                placeholder="https://example.com"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Section 2: Address */}
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              fieldId={fields.address.id}
              label="Street Address"
              errors={fields.address.errors}
            >
              <Input
                {...getInputProps(fields.address, { type: "text" })}
                key={fields.address.key}
                placeholder="123 Main St"
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
          </CardContent>
        </Card>

        {/* Section 3: Subscription */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              fieldId={fields.subscriptionPlan.id}
              label="Subscription Plan"
              errors={fields.subscriptionPlan.errors}
            >
              <NativeSelect
                {...getSelectProps(fields.subscriptionPlan)}
                key={fields.subscriptionPlan.key}
              >
                <NativeSelectOption value="free">Free</NativeSelectOption>
                <NativeSelectOption value="starter">Starter</NativeSelectOption>
                <NativeSelectOption value="professional">Professional</NativeSelectOption>
                <NativeSelectOption value="enterprise">Enterprise</NativeSelectOption>
              </NativeSelect>
            </Field>
          </CardContent>
        </Card>

        {/* Section 4: Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <LogoUpload />
            <BrandingColorSection />
          </CardContent>
        </Card>

        {/* Section 5: Initial Administrator */}
        <Card>
          <CardHeader>
            <CardTitle>Initial Administrator</CardTitle>
            <p className="text-sm text-muted-foreground">
              Optionally create the first admin user for this tenant. Leave empty to add users
              later.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              fieldId={fields.adminEmail.id}
              label="Admin Email"
              errors={fields.adminEmail.errors}
            >
              <Input
                {...getInputProps(fields.adminEmail, { type: "email" })}
                key={fields.adminEmail.key}
                placeholder="admin@newtenant.com"
              />
            </Field>

            <Field
              fieldId={fields.adminName.id}
              label="Admin Name"
              errors={fields.adminName.errors}
            >
              <Input
                {...getInputProps(fields.adminName, { type: "text" })}
                key={fields.adminName.key}
                placeholder="John Doe"
              />
            </Field>

            <Field
              fieldId={fields.adminPassword.id}
              label="Admin Password"
              errors={fields.adminPassword.errors}
            >
              <Input
                {...getInputProps(fields.adminPassword, { type: "password" })}
                key={fields.adminPassword.key}
                placeholder="Minimum 8 characters"
              />
            </Field>

            <p className="text-xs text-muted-foreground">
              The username will be auto-derived from the email (part before @). The user will be
              assigned the TENANT_ADMIN role.
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit">Create Tenant</Button>
          <Button type="button" variant="outline" asChild>
            <a href={`${basePrefix}/tenants`}>Cancel</a>
          </Button>
        </div>
      </Form>
    </div>
  );
}
