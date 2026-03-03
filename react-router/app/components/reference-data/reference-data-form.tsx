import type { ReactNode } from "react";
import { Form, Link } from "react-router";
import type { FormMetadata } from "@conform-to/react";
import { getFormProps, getInputProps } from "@conform-to/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";

interface ReferenceDataFormProps {
  form: FormMetadata<any>;
  fields: Record<string, any>;
  title: string;
  submitLabel: string;
  cancelUrl: string;
  children?: ReactNode;
}

export function ReferenceDataForm({
  form,
  fields,
  title,
  submitLabel,
  cancelUrl,
  children,
}: ReferenceDataFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field fieldId={fields.code.id} label="Code" required errors={fields.code.errors}>
              <Input
                {...getInputProps(fields.code, { type: "text" })}
                key={fields.code.key}
                placeholder="Unique code"
              />
            </Field>

            <Field fieldId={fields.name.id} label="Name" required errors={fields.name.errors}>
              <Input
                {...getInputProps(fields.name, { type: "text" })}
                key={fields.name.key}
                placeholder="Display name"
              />
            </Field>
          </div>

          {children}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              fieldId={fields.sortOrder.id}
              label="Sort Order"
              errors={fields.sortOrder.errors}
            >
              <Input
                {...getInputProps(fields.sortOrder, { type: "number" })}
                key={fields.sortOrder.key}
                placeholder="0"
              />
            </Field>

            <Field fieldId={fields.isActive.id} label="Status" errors={fields.isActive.errors}>
              <NativeSelect
                name={fields.isActive.name}
                defaultValue={fields.isActive.initialValue ?? "true"}
                key={fields.isActive.key}
              >
                <NativeSelectOption value="true">Active</NativeSelectOption>
                <NativeSelectOption value="false">Inactive</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit">{submitLabel}</Button>
            <Button type="button" variant="outline" asChild>
              <Link to={cancelUrl}>Cancel</Link>
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
