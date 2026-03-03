import { useState, useEffect, useCallback } from "react";
import { Form, Link } from "react-router";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { FieldDefinition } from "~/generated/prisma/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Separator } from "~/components/ui/separator";
import { TypeConfigPanel } from "./TypeConfigPanel";
import { labelToFieldName } from "./+utils";

const FIELD_DATA_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "ENUM",
  "MULTI_ENUM",
  "EMAIL",
  "URL",
  "PHONE",
  "FILE",
  "IMAGE",
  "REFERENCE",
  "FORMULA",
  "JSON",
] as const;

const ENTITY_TYPES = ["Generic", "User", "Tenant"] as const;

interface FieldFormProps {
  field?: FieldDefinition | null;
  errors?: { formErrors?: string[]; error?: string };
  cancelUrl?: string;
}

export function FieldForm({ field, errors, cancelUrl }: FieldFormProps) {
  const basePrefix = useBasePrefix();
  const isEdit = !!field;

  const [label, setLabel] = useState(field?.label ?? "");
  const [name, setName] = useState(field?.name ?? "");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(isEdit);
  const [description, setDescription] = useState(field?.description ?? "");
  const [entityType, setEntityType] = useState(field?.entityType ?? "Generic");
  const [dataType, setDataType] = useState<string>(field?.dataType ?? "TEXT");
  const [isRequired, setIsRequired] = useState(field?.isRequired ?? false);
  const [isUnique, setIsUnique] = useState(field?.isUnique ?? false);
  const [isSearchable, setIsSearchable] = useState(field?.isSearchable ?? false);
  const [isFilterable, setIsFilterable] = useState(field?.isFilterable ?? false);
  const [defaultValue, setDefaultValue] = useState(field?.defaultValue ?? "");
  const [config, setConfig] = useState<Record<string, unknown>>(
    () => (field?.config as Record<string, unknown>) ?? {},
  );

  useEffect(() => {
    if (!nameManuallyEdited && !isEdit) {
      setName(labelToFieldName(label));
    }
  }, [label, nameManuallyEdited, isEdit]);

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    setNameManuallyEdited(true);
  }, []);

  const handleDataTypeChange = useCallback(
    (newType: string) => {
      setDataType(newType);
      if (!isEdit) {
        setConfig({});
      }
    },
    [isEdit],
  );

  return (
    <Form method="post" className="space-y-8">
      {(errors?.formErrors?.[0] || errors?.error) && (
        <div className="rounded-md bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{errors?.formErrors?.[0] || errors?.error}</p>
        </div>
      )}

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="entityType">Entity Type</Label>
            <div className="mt-1 [&>[data-slot=native-select-wrapper]]:w-full">
              <NativeSelect
                id="entityType"
                name="entityType"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full"
              >
                {ENTITY_TYPES.map((et) => (
                  <NativeSelectOption key={et} value={et}>
                    {et}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div>
            <Label htmlFor="label">
              Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="label"
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Passport Number"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="name">
              Field Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. passport_number"
              className="mt-1"
              required
              pattern="^[a-z][a-z0-9_]*$"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, digits, and underscores only.
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description for this field"
            className="mt-1"
            rows={2}
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Field Type</h3>
        <div>
          <Label htmlFor="dataType">Data Type</Label>
          <div className="mt-1 [&>[data-slot=native-select-wrapper]]:w-full">
            <NativeSelect
              id="dataType"
              name="dataType"
              value={dataType}
              onChange={(e) => handleDataTypeChange(e.target.value)}
              className="w-full"
            >
              {FIELD_DATA_TYPES.map((dt) => (
                <NativeSelectOption key={dt} value={dt}>
                  {dt.replace(/_/g, " ")}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>

        <TypeConfigPanel dataType={dataType} config={config} onChange={setConfig} />
      </section>

      <input type="hidden" name="config" value={JSON.stringify(config)} />

      <Separator />

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Constraints</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isRequired">Required</Label>
              <p className="text-xs text-muted-foreground">Field must be filled in</p>
            </div>
            <Switch id="isRequired" checked={isRequired} onCheckedChange={setIsRequired} />
            <input type="hidden" name="isRequired" value={isRequired ? "true" : "false"} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isUnique">Unique</Label>
              <p className="text-xs text-muted-foreground">
                No two records can have the same value
              </p>
            </div>
            <Switch id="isUnique" checked={isUnique} onCheckedChange={setIsUnique} />
            <input type="hidden" name="isUnique" value={isUnique ? "true" : "false"} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isSearchable">Searchable</Label>
              <p className="text-xs text-muted-foreground">Include in search queries</p>
            </div>
            <Switch id="isSearchable" checked={isSearchable} onCheckedChange={setIsSearchable} />
            <input type="hidden" name="isSearchable" value={isSearchable ? "true" : "false"} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isFilterable">Filterable</Label>
              <p className="text-xs text-muted-foreground">Show as a filter option</p>
            </div>
            <Switch id="isFilterable" checked={isFilterable} onCheckedChange={setIsFilterable} />
            <input type="hidden" name="isFilterable" value={isFilterable ? "true" : "false"} />
          </div>
        </div>

        <div>
          <Label htmlFor="defaultValue">Default Value</Label>
          <Input
            id="defaultValue"
            name="defaultValue"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder="Optional default value"
            className="mt-1"
          />
        </div>
      </section>

      <Separator />

      <div className="flex items-center gap-3">
        <Button type="submit">{isEdit ? "Save Changes" : "Create Field"}</Button>
        <Link to={cancelUrl ?? `${basePrefix}/settings/fields`}>
          <Button type="button" variant="outline">Cancel</Button>
        </Link>
      </div>
    </Form>
  );
}
