import { useState, useMemo } from "react";
import { Form } from "react-router";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { evaluateCondition } from "~/lib/condition-evaluator";
import type { FormDefinition, FormSection, FormFieldPlacement } from "~/types/form-designer";

// ─── Types ──────────────────────────────────────────────

export interface RendererFieldDef {
  id: string;
  name: string;
  label: string;
  dataType: string;
  isRequired: boolean;
  config: unknown;
}

interface FieldConfig {
  options?: Array<{ value: string; label: string }>;
}

interface FormRendererProps {
  layoutDefinition: FormDefinition;
  fieldDefinitions: RendererFieldDef[];
  errors?: Record<string, string[]>;
  defaultValues?: Record<string, unknown>;
  mode?: "standalone" | "inline";
  fieldNamePrefix?: string;
}

// ─── Main Component ─────────────────────────────────────

export function FormRenderer({
  layoutDefinition,
  fieldDefinitions,
  errors = {},
  defaultValues = {},
  mode = "standalone",
  fieldNamePrefix,
}: FormRendererProps) {
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, unknown>>(defaultValues);

  const fdMap = useMemo(
    () => new Map(fieldDefinitions.map((fd) => [fd.id, fd])),
    [fieldDefinitions],
  );

  const handleValueChange = (fieldName: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const sortedPages = useMemo(
    () => [...layoutDefinition.pages].sort((a, b) => a.order - b.order),
    [layoutDefinition.pages],
  );

  const visiblePages = useMemo(
    () => sortedPages.filter((p) => evaluateCondition(p.visibleIf, formValues)),
    [sortedPages, formValues],
  );

  const currentPage = visiblePages[activePageIndex] ?? visiblePages[0];
  const isMultiPage = visiblePages.length > 1;
  const displayMode = layoutDefinition.settings?.displayMode ?? "wizard";
  const submitText = layoutDefinition.settings?.submitButtonText ?? "Submit";
  const isInline = mode === "inline";

  const content = (
    <>
      {/* Progress bar for wizard mode */}
      {!isInline && isMultiPage && displayMode === "wizard" && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              Page {activePageIndex + 1} of {visiblePages.length}
            </span>
            <span>{currentPage?.title}</span>
          </div>
          {layoutDefinition.settings?.showProgressBar !== false && (
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary transition-all"
                style={{
                  width: `${((activePageIndex + 1) / visiblePages.length) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Render all pages — non-active wizard pages hidden with CSS */}
      {displayMode === "wizard" || displayMode === undefined
        ? visiblePages.map((page, i) => (
            <div key={page.id} className={cn(!isInline && i !== activePageIndex && "hidden")}>
              <RenderPage
                page={page}
                fdMap={fdMap}
                formValues={formValues}
                errors={errors}
                onValueChange={handleValueChange}
                fieldNamePrefix={fieldNamePrefix}
                hidePageHeader={isInline}
              />
            </div>
          ))
        : displayMode === "single-page"
          ? visiblePages.map((page) => (
              <div key={page.id} className="mb-8 last:mb-0">
                {!isInline && <h2 className="text-lg font-semibold mb-4">{page.title}</h2>}
                {!isInline && page.description && (
                  <p className="text-sm text-muted-foreground mb-4">{page.description}</p>
                )}
                <RenderPage
                  page={page}
                  fdMap={fdMap}
                  formValues={formValues}
                  errors={errors}
                  onValueChange={handleValueChange}
                  fieldNamePrefix={fieldNamePrefix}
                  hidePageHeader={isInline}
                />
              </div>
            ))
          : visiblePages.map((page, i) => (
              <Collapsible key={page.id} defaultOpen={i === 0}>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium hover:bg-accent mb-2">
                  {page.title}
                  <ChevronDown className="size-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-1 pb-4">
                  {page.description && (
                    <p className="text-sm text-muted-foreground mb-4">{page.description}</p>
                  )}
                  <RenderPage
                    page={page}
                    fdMap={fdMap}
                    formValues={formValues}
                    errors={errors}
                    onValueChange={handleValueChange}
                    fieldNamePrefix={fieldNamePrefix}
                    hidePageHeader={isInline}
                  />
                </CollapsibleContent>
              </Collapsible>
            ))}

      {/* Wizard navigation — standalone only */}
      {!isInline && isMultiPage && (displayMode === "wizard" || displayMode === undefined) && (
        <>
          <Separator className="my-6" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={activePageIndex === 0}
              onClick={() => setActivePageIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="mr-1 size-3.5" />
              Previous
            </Button>
            {activePageIndex === visiblePages.length - 1 ? (
              <Button type="submit" size="sm" className="w-full sm:w-auto">
                {submitText}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() =>
                  setActivePageIndex((i) => Math.min(visiblePages.length - 1, i + 1))
                }
              >
                Next
                <ChevronRight className="ml-1 size-3.5" />
              </Button>
            )}
          </div>
        </>
      )}

      {/* Submit button for non-wizard modes — standalone only */}
      {!isInline && (!isMultiPage || displayMode !== "wizard") && (
        <>
          <Separator className="my-6" />
          <div className="flex justify-end">
            <Button type="submit" size="sm" className="w-full sm:w-auto">
              {submitText}
            </Button>
          </div>
        </>
      )}
    </>
  );

  if (isInline) {
    return <div className="space-y-4">{content}</div>;
  }

  return <Form method="post">{content}</Form>;
}

// ─── Page Renderer ──────────────────────────────────────

function RenderPage({
  page,
  fdMap,
  formValues,
  errors,
  onValueChange,
  fieldNamePrefix,
  hidePageHeader,
}: {
  page: FormDefinition["pages"][number];
  fdMap: Map<string, RendererFieldDef>;
  formValues: Record<string, unknown>;
  errors: Record<string, string[]>;
  onValueChange: (fieldName: string, value: unknown) => void;
  fieldNamePrefix?: string;
  hidePageHeader?: boolean;
}) {
  const sortedSections = [...page.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {!hidePageHeader && page.title && (page.description || sortedSections.length > 1) && (
        <div>
          <h2 className="text-lg font-semibold">{page.title}</h2>
          {page.description && (
            <p className="mt-1 text-sm text-muted-foreground">{page.description}</p>
          )}
        </div>
      )}

      {sortedSections.map((section) => {
        if (!evaluateCondition(section.visibleIf, formValues)) return null;

        return (
          <RenderSection
            key={section.id}
            section={section}
            fdMap={fdMap}
            formValues={formValues}
            errors={errors}
            onValueChange={onValueChange}
            fieldNamePrefix={fieldNamePrefix}
          />
        );
      })}
    </div>
  );
}

// ─── Section Renderer ───────────────────────────────────

function RenderSection({
  section,
  fdMap,
  formValues,
  errors,
  onValueChange,
  fieldNamePrefix,
}: {
  section: FormSection;
  fdMap: Map<string, RendererFieldDef>;
  formValues: Record<string, unknown>;
  errors: Record<string, string[]>;
  onValueChange: (fieldName: string, value: unknown) => void;
  fieldNamePrefix?: string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(section.defaultCollapsed ?? false);
  const sortedFields = [...section.fields].sort((a, b) => a.order - b.order);
  const defaultColSpan = Math.floor(12 / section.columns);

  const visibleFields = sortedFields.filter((f) => evaluateCondition(f.visibleIf, formValues));

  if (visibleFields.length === 0 && !section.title) return null;

  const content = (
    <div className="grid grid-cols-12 gap-4">
      {visibleFields.map((field) => {
        const fd = fdMap.get(field.fieldDefinitionId);
        if (!fd) return null;

        const colSpan = field.colSpan ?? defaultColSpan;

        return (
          <div key={field.id} style={{ gridColumn: `span ${Math.min(Math.max(colSpan, 1), 12)}` }}>
            <RenderField
              field={field}
              fd={fd}
              value={formValues[fd.name]}
              errors={errors[fd.name]}
              onChange={(v) => onValueChange(fd.name, v)}
              fieldNamePrefix={fieldNamePrefix}
            />
          </div>
        );
      })}
    </div>
  );

  if (section.collapsible) {
    return (
      <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
        <div className="rounded-lg border">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-accent/50">
            <div>
              {section.title}
              {section.description && (
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  {section.description}
                </p>
              )}
            </div>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                !isCollapsed && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t px-4 py-4">{content}</div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <div>
      {section.title && (
        <div className="mb-3">
          <h3 className="text-sm font-medium">{section.title}</h3>
          {section.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{section.description}</p>
          )}
        </div>
      )}
      {content}
    </div>
  );
}

// ─── Field Renderer ─────────────────────────────────────

function getFieldConfig(fd: RendererFieldDef): FieldConfig {
  if (fd.config && typeof fd.config === "object" && !Array.isArray(fd.config)) {
    return fd.config as unknown as FieldConfig;
  }
  return {};
}

function RenderField({
  field,
  fd,
  value,
  errors,
  onChange,
  fieldNamePrefix,
}: {
  field: FormFieldPlacement;
  fd: RendererFieldDef;
  value: unknown;
  errors?: string[];
  onChange: (v: unknown) => void;
  fieldNamePrefix?: string;
}) {
  const fieldId = `field-${field.id}`;
  const fieldName = fieldNamePrefix ? `${fieldNamePrefix}.${fd.name}` : fd.name;
  const config = getFieldConfig(fd);
  const hasError = errors && errors.length > 0;

  switch (fd.dataType) {
    case "TEXT":
    case "EMAIL":
    case "URL":
    case "PHONE":
    case "REFERENCE": {
      const inputType =
        fd.dataType === "EMAIL"
          ? "email"
          : fd.dataType === "URL"
            ? "url"
            : fd.dataType === "PHONE"
              ? "tel"
              : "text";
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <Input
            id={fieldId}
            name={fieldName}
            type={inputType}
            defaultValue={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={hasError || undefined}
          />
        </FieldWrapper>
      );
    }

    case "LONG_TEXT":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <Textarea
            id={fieldId}
            name={fieldName}
            rows={3}
            defaultValue={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={hasError || undefined}
          />
        </FieldWrapper>
      );

    case "NUMBER":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <Input
            id={fieldId}
            name={fieldName}
            type="number"
            defaultValue={value != null ? String(value) : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            aria-invalid={hasError || undefined}
          />
        </FieldWrapper>
      );

    case "BOOLEAN":
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              id={fieldId}
              name={fieldName}
              type="checkbox"
              defaultChecked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              value="true"
            />
            <Label htmlFor={fieldId}>
              {fd.label}
              {fd.isRequired && <span className="ml-1 text-destructive">*</span>}
            </Label>
          </div>
          {hasError && <FieldErrors errors={errors} />}
        </div>
      );

    case "DATE":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <Input
            id={fieldId}
            name={fieldName}
            type="date"
            defaultValue={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={hasError || undefined}
          />
        </FieldWrapper>
      );

    case "DATETIME":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <Input
            id={fieldId}
            name={fieldName}
            type="datetime-local"
            defaultValue={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={hasError || undefined}
          />
        </FieldWrapper>
      );

    case "ENUM": {
      const options = config.options ?? [];
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <NativeSelect
            id={fieldId}
            name={fieldName}
            defaultValue={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">Select {fd.label}...</NativeSelectOption>
            {options.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FieldWrapper>
      );
    }

    case "MULTI_ENUM": {
      const options = config.options ?? [];
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <div className="mt-1 space-y-2">
            {options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name={fieldName}
                  value={opt.value}
                  defaultChecked={Array.isArray(value) && value.includes(opt.value)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </FieldWrapper>
      );
    }

    case "FILE":
    case "IMAGE":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <Input
            id={fieldId}
            name={fieldName}
            type="file"
            accept={fd.dataType === "IMAGE" ? "image/*" : undefined}
          />
        </FieldWrapper>
      );

    case "FORMULA":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={false} errors={errors}>
          <span className="block text-sm text-muted-foreground italic">(Computed field)</span>
        </FieldWrapper>
      );

    case "JSON":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <Textarea
            id={fieldId}
            name={fieldName}
            rows={4}
            defaultValue={
              value != null ? (typeof value === "string" ? value : JSON.stringify(value, null, 2)) : ""
            }
            onChange={(e) => onChange(e.target.value)}
            className="font-mono text-sm"
            aria-invalid={hasError || undefined}
          />
        </FieldWrapper>
      );

    default:
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label} required={fd.isRequired} errors={errors}>
          <Input
            id={fieldId}
            name={fieldName}
            type="text"
            defaultValue={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={hasError || undefined}
          />
        </FieldWrapper>
      );
  }
}

// ─── Field Wrapper ──────────────────────────────────────

function FieldWrapper({
  fieldId,
  label,
  required,
  errors,
  children,
}: {
  fieldId: string;
  label: string;
  required: boolean;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {errors && errors.length > 0 && <FieldErrors errors={errors} />}
    </div>
  );
}

function FieldErrors({ errors }: { errors: string[] }) {
  return (
    <div className="space-y-1">
      {errors.map((err, i) => (
        <p key={i} className="text-sm text-destructive">
          {err}
        </p>
      ))}
    </div>
  );
}
