import type { FormMetadata } from "@conform-to/react";
import type { FieldDefinition } from "~/generated/prisma/client";
import { FieldRenderer } from "./FieldRenderer";
import { sortFieldDefs } from "./types";

const FULL_WIDTH_TYPES = new Set(["LONG_TEXT", "BOOLEAN", "JSON", "MULTI_ENUM"]);

interface FieldSectionProps {
  title?: string;
  description?: string;
  fieldDefs: FieldDefinition[];
  form: FormMetadata<Record<string, unknown>>;
  columns?: 1 | 2;
}

export function FieldSection({
  title,
  description,
  fieldDefs,
  form,
  columns = 2,
}: FieldSectionProps) {
  if (fieldDefs.length === 0) return null;

  const sorted = sortFieldDefs(fieldDefs);
  const fieldset = form.getFieldset();

  return (
    <div>
      {title && <h3 className="text-lg font-medium text-foreground">{title}</h3>}
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div
        className={`${title || description ? "mt-4" : ""} grid gap-4 grid-cols-1 ${
          columns === 2 ? "md:grid-cols-2" : ""
        }`}
      >
        {sorted.map((fieldDef) => {
          const meta = fieldset[fieldDef.name];
          if (!meta) return null;

          const isFullWidth = columns === 2 && FULL_WIDTH_TYPES.has(fieldDef.dataType);

          return (
            <div key={fieldDef.id} className={isFullWidth ? "md:col-span-2" : ""}>
              <FieldRenderer fieldDef={fieldDef} meta={meta} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
