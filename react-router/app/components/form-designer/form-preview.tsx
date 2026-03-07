import { useState, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarIcon,
  Monitor,
  Tablet,
  Smartphone,
  X,
} from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/utils/utils";
import { evaluateCondition } from "~/utils/condition-evaluator";
import { generateMockData } from "~/utils/form-preview-data";
import type { FormDefinition, FormSection, FormFieldPlacement } from "~/types/form-designer";

// ─── Types ──────────────────────────────────────────────

export type DeviceSize = "desktop" | "tablet" | "phone";

interface FieldDefinitionLookup {
  id: string;
  name: string;
  label: string;
  dataType: string;
}

interface FormPreviewProps {
  definition: FormDefinition;
  fieldDefinitions: FieldDefinitionLookup[];
  /** Show device size toggle and close button in standalone (preview) mode */
  standalone?: boolean;
  onClose?: () => void;
}

const deviceWidths: Record<DeviceSize, string> = {
  desktop: "100%",
  tablet: "768px",
  phone: "375px",
};

const deviceIcons: { size: DeviceSize; icon: typeof Monitor; label: string }[] = [
  { size: "desktop", icon: Monitor, label: "Desktop" },
  { size: "tablet", icon: Tablet, label: "Tablet" },
  { size: "phone", icon: Smartphone, label: "Phone" },
];

// ─── Main Component ─────────────────────────────────────

export function FormPreview({
  definition,
  fieldDefinitions,
  standalone = false,
  onClose,
}: FormPreviewProps) {
  const [deviceSize, setDeviceSize] = useState<DeviceSize>("desktop");
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Generate mock data once and allow editing
  const [formValues, setFormValues] = useState<Record<string, unknown>>(() =>
    generateMockData(definition, fieldDefinitions),
  );

  const fdMap = useMemo(
    () => new Map(fieldDefinitions.map((fd) => [fd.id, fd])),
    [fieldDefinitions],
  );

  const handleValueChange = useCallback((fieldDefId: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [fieldDefId]: value }));
  }, []);

  const sortedPages = useMemo(
    () => [...definition.pages].sort((a, b) => a.order - b.order),
    [definition.pages],
  );

  // Filter visible pages based on conditions
  const visiblePages = useMemo(
    () => sortedPages.filter((p) => evaluateCondition(p.visibleIf, formValues)),
    [sortedPages, formValues],
  );

  const currentPage = visiblePages[activePageIndex] ?? visiblePages[0];
  const isMultiPage = visiblePages.length > 1;
  const displayMode = definition.settings?.displayMode ?? "wizard";

  return (
    <div className="flex h-full flex-col bg-muted/30">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b bg-background px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Preview</span>

        {/* Device size toggle */}
        <div className="ml-2 flex items-center rounded-md border bg-muted p-0.5">
          {deviceIcons.map(({ size, icon: Icon, label }) => (
            <button
              key={size}
              onClick={() => setDeviceSize(size)}
              title={label}
              className={cn(
                "inline-flex items-center justify-center rounded-sm px-1.5 py-1 transition-colors",
                deviceSize === size
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>

        {standalone && onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={onClose}
            title="Back to editor"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div
          className={cn(
            "mx-auto rounded-lg border bg-background shadow-sm transition-all",
            deviceSize !== "desktop" && "border-2",
          )}
          style={{ maxWidth: deviceWidths[deviceSize] }}
        >
          <div className="p-6">
            {/* Form title from settings */}
            {definition.settings?.submitButtonText && (
              <p className="mb-1 text-xs text-muted-foreground">Form preview</p>
            )}

            {/* Progress bar for wizard mode */}
            {isMultiPage && displayMode === "wizard" && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>
                    Page {activePageIndex + 1} of {visiblePages.length}
                  </span>
                  <span>{currentPage?.title}</span>
                </div>
                {definition.settings?.showProgressBar !== false && (
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

            {/* Render pages */}
            {displayMode === "wizard" || displayMode === undefined
              ? // Wizard: show one page at a time
                currentPage && (
                  <PreviewPage
                    page={currentPage}
                    fdMap={fdMap}
                    formValues={formValues}
                    onValueChange={handleValueChange}
                  />
                )
              : displayMode === "single-page"
                ? // Single-page: show all pages stacked
                  visiblePages.map((page) => (
                    <div key={page.id} className="mb-8 last:mb-0">
                      <h2 className="text-lg font-semibold mb-4">{page.title}</h2>
                      {page.description && (
                        <p className="text-sm text-muted-foreground mb-4">{page.description}</p>
                      )}
                      <PreviewPage
                        page={page}
                        fdMap={fdMap}
                        formValues={formValues}
                        onValueChange={handleValueChange}
                      />
                    </div>
                  ))
                : // Accordion: collapsible pages
                  visiblePages.map((page, i) => (
                    <Collapsible key={page.id} defaultOpen={i === 0}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium hover:bg-accent mb-2">
                        {page.title}
                        <ChevronDown className="size-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-1 pb-4">
                        {page.description && (
                          <p className="text-sm text-muted-foreground mb-4">{page.description}</p>
                        )}
                        <PreviewPage
                          page={page}
                          fdMap={fdMap}
                          formValues={formValues}
                          onValueChange={handleValueChange}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  ))}

            {/* Wizard navigation */}
            {isMultiPage && (displayMode === "wizard" || displayMode === undefined) && (
              <>
                <Separator className="my-6" />
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activePageIndex === 0}
                    onClick={() => setActivePageIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeft className="mr-1 size-3.5" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    disabled={activePageIndex === visiblePages.length - 1}
                    onClick={() =>
                      setActivePageIndex((i) => Math.min(visiblePages.length - 1, i + 1))
                    }
                  >
                    {activePageIndex === visiblePages.length - 1 ? (
                      (definition.settings?.submitButtonText ?? "Submit")
                    ) : (
                      <>
                        Next
                        <ChevronRight className="ml-1 size-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Submit button for non-wizard modes */}
            {(!isMultiPage || displayMode !== "wizard") && (
              <>
                <Separator className="my-6" />
                <div className="flex justify-end">
                  <Button size="sm">{definition.settings?.submitButtonText ?? "Submit"}</Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page Renderer ──────────────────────────────────────

function PreviewPage({
  page,
  fdMap,
  formValues,
  onValueChange,
}: {
  page: FormDefinition["pages"][number];
  fdMap: Map<string, FieldDefinitionLookup>;
  formValues: Record<string, unknown>;
  onValueChange: (fieldDefId: string, value: unknown) => void;
}) {
  const sortedSections = [...page.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {page.title && (page.description || sortedSections.length > 1) && (
        <div>
          <h2 className="text-lg font-semibold">{page.title}</h2>
          {page.description && (
            <p className="mt-1 text-sm text-muted-foreground">{page.description}</p>
          )}
        </div>
      )}

      {sortedSections.map((section) => {
        // Evaluate section visibility
        if (!evaluateCondition(section.visibleIf, formValues)) return null;

        return (
          <PreviewSection
            key={section.id}
            section={section}
            fdMap={fdMap}
            formValues={formValues}
            onValueChange={onValueChange}
          />
        );
      })}
    </div>
  );
}

// ─── Section Renderer ───────────────────────────────────

function PreviewSection({
  section,
  fdMap,
  formValues,
  onValueChange,
}: {
  section: FormSection;
  fdMap: Map<string, FieldDefinitionLookup>;
  formValues: Record<string, unknown>;
  onValueChange: (fieldDefId: string, value: unknown) => void;
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
            <PreviewField
              field={field}
              fd={fd}
              value={formValues[fd.id]}
              onChange={(v) => onValueChange(fd.id, v)}
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
// Mirrors the production FieldRenderer output without Conform bindings.

function PreviewField({
  field,
  fd,
  value,
  onChange,
}: {
  field: FormFieldPlacement;
  fd: FieldDefinitionLookup;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const fieldId = `preview-${field.id}`;

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
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <Input
            id={fieldId}
            type={inputType}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </FieldWrapper>
      );
    }

    case "LONG_TEXT":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <Textarea
            id={fieldId}
            rows={3}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </FieldWrapper>
      );

    case "NUMBER":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <Input
            id={fieldId}
            type="number"
            value={value != null ? String(value) : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
        </FieldWrapper>
      );

    case "BOOLEAN":
      return (
        <div className="flex items-center gap-2">
          <input
            id={fieldId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <Label htmlFor={fieldId}>{fd.label}</Label>
        </div>
      );

    case "DATE":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <DatePickerField value={String(value ?? "")} onChange={(v) => onChange(v)} />
        </FieldWrapper>
      );

    case "DATETIME":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <DatePickerField value={String(value ?? "")} onChange={(v) => onChange(v)} includeTime />
        </FieldWrapper>
      );

    case "ENUM":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <NativeSelect
            id={fieldId}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">Select {fd.label}...</NativeSelectOption>
            <NativeSelectOption value="option-1">Option 1</NativeSelectOption>
            <NativeSelectOption value="option-2">Option 2</NativeSelectOption>
            <NativeSelectOption value="option-3">Option 3</NativeSelectOption>
          </NativeSelect>
        </FieldWrapper>
      );

    case "MULTI_ENUM":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <div className="mt-1 space-y-2">
            {["Option A", "Option B", "Option C"].map((opt) => (
              <label key={opt} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                  checked={Array.isArray(value) && value.includes(opt)}
                  onChange={(e) => {
                    const arr = Array.isArray(value) ? [...value] : [];
                    if (e.target.checked) {
                      arr.push(opt);
                    } else {
                      const idx = arr.indexOf(opt);
                      if (idx !== -1) arr.splice(idx, 1);
                    }
                    onChange(arr);
                  }}
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </FieldWrapper>
      );

    case "FILE":
    case "IMAGE":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <Input
            id={fieldId}
            type="file"
            accept={fd.dataType === "IMAGE" ? "image/*" : undefined}
            disabled
          />
        </FieldWrapper>
      );

    case "FORMULA":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <span className="block text-sm text-muted-foreground italic">(Computed field)</span>
        </FieldWrapper>
      );

    case "JSON":
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <Textarea
            id={fieldId}
            rows={4}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono text-sm"
          />
        </FieldWrapper>
      );

    default:
      return (
        <FieldWrapper fieldId={fieldId} label={fd.label}>
          <Input
            id={fieldId}
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </FieldWrapper>
      );
  }
}

// ─── Date Picker ────────────────────────────────────────

function DatePickerField({
  value,
  onChange,
  includeTime = false,
}: {
  value: string;
  onChange: (v: string) => void;
  includeTime?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Parse the string value to a Date for the calendar
  const dateValue = (() => {
    if (!value) return undefined;
    const fmt = includeTime ? "yyyy-MM-dd'T'HH:mm" : "yyyy-MM-dd";
    const parsed = parse(value, fmt, new Date());
    return isValid(parsed) ? parsed : undefined;
  })();

  const displayText = dateValue
    ? includeTime
      ? format(dateValue, "PPP p")
      : format(dateValue, "PPP")
    : "Pick a date";

  // Extract time portion for the time input
  const timePart = includeTime && value.includes("T") ? (value.split("T")[1] ?? "09:00") : "09:00";

  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !dateValue && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {displayText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(date) => {
              if (date) {
                const dateStr = format(date, "yyyy-MM-dd");
                onChange(includeTime ? `${dateStr}T${timePart}` : dateStr);
              } else {
                onChange("");
              }
              if (!includeTime) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {includeTime && (
        <Input
          type="time"
          value={timePart}
          onChange={(e) => {
            const datePart = value.includes("T")
              ? value.split("T")[0]
              : value || format(new Date(), "yyyy-MM-dd");
            onChange(`${datePart}T${e.target.value}`);
          }}
        />
      )}
    </div>
  );
}

// ─── Field Wrapper ──────────────────────────────────────
// Matches the production Field layout

function FieldWrapper({
  fieldId,
  label,
  children,
}: {
  fieldId: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      {children}
    </div>
  );
}
