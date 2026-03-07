import { useState, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Search, GripVertical, LayoutGrid, AlertTriangle } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "~/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "~/utils/misc";
import { getFieldTypeIcon, getFieldTypeLabel, fieldCategories } from "./field-type-icons";
import { makePaletteDndId } from "./dnd-designer-context";
import type { FormSection } from "~/types/form-designer";

interface FieldDefinitionItem {
  id: string;
  name: string;
  label: string;
  dataType: string;
}

export interface SectionTemplateItem {
  id: string;
  name: string;
  description: string | null;
  definition: unknown;
}

interface FieldPaletteProps {
  fields: FieldDefinitionItem[];
  fieldsUrl?: string;
  activePageId: string | null;
  activeSectionId: string | null;
  onAddField: (fieldDefinitionId: string) => void;
  sectionTemplates?: SectionTemplateItem[];
  onAddSectionFromTemplate?: (template: SectionTemplateItem) => void;
}

export function FieldPalette({
  fields,
  fieldsUrl,
  activePageId,
  activeSectionId,
  onAddField,
  sectionTemplates = [],
  onAddSectionFromTemplate,
}: FieldPaletteProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <Tabs defaultValue="fields" className="flex h-full flex-col gap-0">
        <div className="flex items-center border-b bg-muted/30 px-3">
          <TabsList className="h-8 w-full bg-transparent p-0">
            <TabsTrigger
              value="fields"
              className="h-8 flex-1 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Fields
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="h-8 flex-1 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Sections
              {sectionTemplates.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {sectionTemplates.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="fields" className="flex-1 overflow-hidden">
          <FieldsTab
            fields={fields}
            fieldsUrl={fieldsUrl}
            activePageId={activePageId}
            activeSectionId={activeSectionId}
            onAddField={onAddField}
          />
        </TabsContent>

        <TabsContent value="templates" className="flex-1 overflow-hidden">
          <TemplatesTab
            templates={sectionTemplates}
            fieldDefinitions={fields}
            activePageId={activePageId}
            onAddSectionFromTemplate={onAddSectionFromTemplate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FieldsTab({
  fields,
  fieldsUrl,
  activePageId,
  activeSectionId,
  onAddField,
}: {
  fields: FieldDefinitionItem[];
  fieldsUrl?: string;
  activePageId: string | null;
  activeSectionId: string | null;
  onAddField: (fieldDefinitionId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredFields = fields.filter(
    (f) =>
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.name.toLowerCase().includes(search.toLowerCase()),
  );

  const groupedFields = fieldCategories
    .map((cat) => ({
      ...cat,
      fields: filteredFields.filter((f) => cat.types.includes(f.dataType)),
    }))
    .filter((cat) => cat.fields.length > 0);

  const canAdd = activePageId !== null && activeSectionId !== null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {fields.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <p>No fields defined yet.</p>
            {fieldsUrl && (
              <a
                href={fieldsUrl}
                className="mt-1 inline-block text-primary hover:underline"
              >
                Create fields
              </a>
            )}
          </div>
        ) : filteredFields.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No fields match &ldquo;{search}&rdquo;
          </div>
        ) : (
          groupedFields.map((group) => (
            <Collapsible key={group.label} defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                <ChevronRight className="size-3 transition-transform [[data-state=open]>&]:rotate-90" />
                {group.label}
                <span className="ml-auto text-[10px]">{group.fields.length}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-1 space-y-0.5 pb-2">
                  {group.fields.map((field) => (
                    <DraggablePaletteItem
                      key={field.id}
                      field={field}
                      canAdd={canAdd}
                      onAddField={onAddField}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
}

function TemplatesTab({
  templates,
  fieldDefinitions,
  activePageId,
  onAddSectionFromTemplate,
}: {
  templates: SectionTemplateItem[];
  fieldDefinitions: FieldDefinitionItem[];
  activePageId: string | null;
  onAddSectionFromTemplate?: (template: SectionTemplateItem) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  const fdIdSet = new Set(fieldDefinitions.map((fd) => fd.id));

  const getMissingFields = useCallback(
    (template: SectionTemplateItem): string[] => {
      const def = template.definition as FormSection | null;
      if (!def?.fields) return [];
      return def.fields
        .filter((f) => !fdIdSet.has(f.fieldDefinitionId))
        .map((f) => f.fieldDefinitionId);
    },
    [fdIdSet],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {templates.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <p>No saved sections yet.</p>
            <p className="mt-1">
              Right-click a section and select
              <br />
              &ldquo;Save as template&rdquo; to reuse it.
            </p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No templates match &ldquo;{search}&rdquo;
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTemplates.map((template) => {
              const missingFields = getMissingFields(template);
              const def = template.definition as FormSection | null;
              const fieldCount = def?.fields?.length ?? 0;

              return (
                <button
                  key={template.id}
                  onClick={() => onAddSectionFromTemplate?.(template)}
                  disabled={!activePageId}
                  title={
                    !activePageId
                      ? "Select a page first"
                      : missingFields.length > 0
                        ? `Warning: ${missingFields.length} field(s) not found`
                        : `Add "${template.name}" section`
                  }
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded px-2 py-2 text-left text-xs transition-colors",
                    activePageId
                      ? "hover:bg-accent cursor-pointer"
                      : "opacity-50 cursor-not-allowed",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <LayoutGrid className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{template.name}</span>
                    {missingFields.length > 0 && (
                      <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                    )}
                  </div>
                  {template.description && (
                    <p className="ml-5 truncate text-[10px] text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                  <div className="ml-5 flex gap-2 text-[10px] text-muted-foreground">
                    <span>{def?.columns ?? 2} col</span>
                    <span>{fieldCount} field{fieldCount !== 1 ? "s" : ""}</span>
                    {missingFields.length > 0 && (
                      <span className="text-amber-500">{missingFields.length} missing</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DraggablePaletteItem({
  field,
  canAdd,
  onAddField,
}: {
  field: FieldDefinitionItem;
  canAdd: boolean;
  onAddField: (fieldDefinitionId: string) => void;
}) {
  const dndId = makePaletteDndId(field.id);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dndId,
    data: { type: "palette", fieldDefinitionId: field.id },
  });

  const Icon = getFieldTypeIcon(field.dataType);

  return (
    <button
      ref={setNodeRef}
      onClick={() => onAddField(field.id)}
      disabled={!canAdd}
      title={canAdd ? `Add "${field.label}" to current section` : "Select a section first"}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
        canAdd ? "hover:bg-accent cursor-pointer" : "opacity-50 cursor-not-allowed",
        isDragging && "opacity-30",
      )}
    >
      <span
        className="shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </span>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{field.label}</span>
      <span className="ml-auto text-[10px] text-muted-foreground">
        {getFieldTypeLabel(field.dataType)}
      </span>
    </button>
  );
}
