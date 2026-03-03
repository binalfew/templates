import {
  getInputProps,
  getSelectProps,
  getTextareaProps,
  getCollectionProps,
} from "@conform-to/react";
import type { FieldMetadata } from "@conform-to/react";
import type { FieldDefinition } from "~/generated/prisma/client";
import { Checkbox } from "~/components/ui/checkbox";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { getFieldConfig } from "./types";

interface FieldRendererProps {
  fieldDef: FieldDefinition;
  meta: FieldMetadata<unknown>;
}

function inputProps(meta: FieldMetadata<unknown>, opts: { type: string }) {
  const { key, ...rest } = getInputProps(meta, opts as Parameters<typeof getInputProps>[1]);
  return { key, props: rest };
}

function textareaProps(meta: FieldMetadata<unknown>) {
  const { key, ...rest } = getTextareaProps(meta);
  return { key, props: rest };
}

function selectPropsHelper(meta: FieldMetadata<unknown>) {
  const { key, ...rest } = getSelectProps(meta);
  return { key, props: rest };
}

export function FieldRenderer({ fieldDef, meta }: FieldRendererProps) {
  const config = getFieldConfig(fieldDef);

  switch (fieldDef.dataType) {
    case "TEXT": {
      const { key, props } = inputProps(meta, { type: "text" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input
            key={key}
            {...props}
            placeholder={config.placeholder}
            maxLength={config.maxLength}
            pattern={config.pattern}
          />
        </Field>
      );
    }

    case "LONG_TEXT": {
      const { key, props } = textareaProps(meta);
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Textarea key={key} {...props} rows={config.rows ?? 3} maxLength={config.maxLength} />
        </Field>
      );
    }

    case "NUMBER": {
      const { key, props } = inputProps(meta, { type: "number" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input
            key={key}
            {...props}
            min={config.min}
            max={config.max}
            step={config.step}
            placeholder={config.placeholder}
          />
        </Field>
      );
    }

    case "BOOLEAN": {
      const { key, props } = inputProps(meta, { type: "checkbox" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
          inline
        >
          <Checkbox
            key={key}
            id={props.id}
            name={props.name}
            value="on"
            defaultChecked={props.defaultChecked}
          />
        </Field>
      );
    }

    case "DATE": {
      const { key, props } = inputProps(meta, { type: "date" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input key={key} {...props} min={config.minDate} max={config.maxDate} />
        </Field>
      );
    }

    case "DATETIME": {
      const { key, props } = inputProps(meta, { type: "datetime-local" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input key={key} {...props} min={config.minDate} max={config.maxDate} />
        </Field>
      );
    }

    case "ENUM": {
      const options = config.options ?? [];
      const { key, props } = selectPropsHelper(meta);
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <NativeSelect key={key} {...props} className="w-full">
            <NativeSelectOption value="">Select {fieldDef.label}...</NativeSelectOption>
            {options.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      );
    }

    case "MULTI_ENUM": {
      const options = config.options ?? [];
      const labelMap = new Map(options.map((o) => [o.value, o.label]));
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <div className="mt-1 space-y-2">
            {getCollectionProps(meta, {
              type: "checkbox",
              options: options.map((o) => o.value),
            }).map(({ key, ...checkboxProps }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  id={checkboxProps.id}
                  name={checkboxProps.name}
                  value={checkboxProps.value}
                  defaultChecked={checkboxProps.defaultChecked}
                />
                <span className="text-sm text-foreground">
                  {labelMap.get(checkboxProps.value ?? "") ?? checkboxProps.value}
                </span>
              </label>
            ))}
          </div>
        </Field>
      );
    }

    case "EMAIL": {
      const { key, props } = inputProps(meta, { type: "email" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input key={key} {...props} placeholder={config.placeholder} />
        </Field>
      );
    }

    case "URL": {
      const { key, props } = inputProps(meta, { type: "url" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input key={key} {...props} placeholder={config.placeholder} />
        </Field>
      );
    }

    case "PHONE": {
      const { key, props } = inputProps(meta, { type: "tel" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input key={key} {...props} placeholder={config.placeholder} />
        </Field>
      );
    }

    case "FILE": {
      const { key, props } = inputProps(meta, { type: "file" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input key={key} {...props} accept={config.accept} />
        </Field>
      );
    }

    case "IMAGE": {
      const { key, props } = inputProps(meta, { type: "file" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input key={key} {...props} accept={config.accept ?? "image/*"} />
        </Field>
      );
    }

    case "REFERENCE": {
      const { key, props } = inputProps(meta, { type: "text" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input key={key} {...props} placeholder="Enter ID" />
        </Field>
      );
    }

    case "FORMULA":
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
        >
          <span className="mt-1 block text-sm text-muted-foreground italic">(Computed field)</span>
        </Field>
      );

    case "JSON": {
      const { key, props } = textareaProps(meta);
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Textarea key={key} {...props} rows={config.rows ?? 5} className="font-mono text-sm" />
        </Field>
      );
    }

    default: {
      const { key, props } = inputProps(meta, { type: "text" });
      return (
        <Field
          fieldId={meta.id}
          label={fieldDef.label}
          description={fieldDef.description}
          errors={meta.errors}
          required={fieldDef.isRequired}
        >
          <Input key={key} {...props} />
        </Field>
      );
    }
  }
}
