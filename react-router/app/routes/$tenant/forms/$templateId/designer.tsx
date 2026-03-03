import { useCallback, useEffect, useRef, useState } from "react";
import { data, Link, useFetcher, useLoaderData, useParams } from "react-router";
import {
  ArrowLeft,
  Save,
  Upload,
  Undo2,
  Redo2,
  Monitor,
  Columns2,
  Eye,
} from "lucide-react";
import { requireFeature } from "~/lib/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { buildServiceContext } from "~/lib/request-context.server";
import { prisma } from "~/lib/db.server";
import { listFields } from "~/services/fields.server";
import {
  getSectionTemplate,
  publishTemplate,
  unpublishTemplate,
} from "~/services/section-templates.server";
import { useFormDesigner } from "~/hooks/use-form-designer";
import type { AutosaveStatus } from "~/hooks/use-autosave";
import {
  DesignCanvas,
  DndDesignerContext,
  FieldPalette,
  FormPreview,
  PropertiesPanel,
} from "~/components/form-designer";
import type { SectionTemplateItem } from "~/components/form-designer";
import type { FormDefinition, FormSection } from "~/types/form-designer";
import { SaveTemplateDialog } from "~/components/form-designer/save-template-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { AutosaveIndicator } from "~/components/form-designer/autosave-indicator";
import { cn } from "~/lib/utils";
import type { ViewMode } from "~/types/designer-state";
import type { Route } from "./+types/designer";

export const handle = { breadcrumb: "Designer" };

let nextId = 1;
function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

const DEFAULT_DEFINITION: FormDefinition = {
  settings: {
    displayMode: "single-page",
    showProgressBar: false,
    submitButtonText: "Submit",
    successMessage: "Thank you for your submission.",
  },
  pages: [
    {
      id: "page-1",
      title: "Page 1",
      order: 0,
      sections: [],
    },
  ],
};

function resolveDefinition(definition: unknown): FormDefinition {
  if (
    definition &&
    typeof definition === "object" &&
    "pages" in definition &&
    Array.isArray((definition as any).pages) &&
    (definition as any).pages.length > 0
  ) {
    return definition as FormDefinition;
  }
  return DEFAULT_DEFINITION;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.FORM_DESIGNER);

  const template = await getSectionTemplate(params.templateId, tenantId);

  const entityFilter =
    template.entityType !== "Generic" ? { entityType: template.entityType } : {};
  const fields = await listFields(tenantId, entityFilter);
  const fieldDefinitions = fields.map((f) => ({
    id: f.id,
    name: f.name,
    label: f.label,
    dataType: f.dataType,
  }));

  const sectionTemplates = await prisma.sectionTemplate.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, definition: true },
  });

  // Only include templates that have a valid section definition (fields array),
  // filtering out form templates that have empty {} or full page-based definitions.
  const validSectionTemplates = sectionTemplates.filter((t) => {
    const def = t.definition as Record<string, unknown> | null;
    return def && Array.isArray(def.fields);
  });

  return {
    template,
    fieldDefinitions,
    sectionTemplates: validSectionTemplates,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.FORM_DESIGNER);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save-template") {
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const definitionJson = formData.get("definition") as string;

    if (!name?.trim()) {
      return data({ error: "Template name is required" }, { status: 400 });
    }

    try {
      const definition = JSON.parse(definitionJson);
      await prisma.sectionTemplate.create({
        data: {
          tenantId,
          name: name.trim(),
          description,
          definition,
        },
      });
      return data({ templateSaved: true });
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
        return data({ error: "A template with this name already exists" }, { status: 409 });
      }
      return data({ error: "Failed to save template" }, { status: 500 });
    }
  }

  if (intent === "save-definition") {
    const definitionJson = formData.get("definition") as string;

    try {
      const definition = JSON.parse(definitionJson);
      await prisma.sectionTemplate.update({
        where: { id: params.templateId },
        data: { definition },
      });
      return data({ definitionSaved: true });
    } catch {
      return data({ error: "Failed to save definition" }, { status: 500 });
    }
  }

  if (intent === "publish") {
    try {
      const ctx = buildServiceContext(request, user, tenantId);
      await publishTemplate(params.templateId, ctx);
      return data({ published: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to publish";
      return data({ error: message }, { status: 400 });
    }
  }

  if (intent === "unpublish") {
    try {
      const ctx = buildServiceContext(request, user, tenantId);
      await unpublishTemplate(params.templateId, ctx);
      return data({ unpublished: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to unpublish";
      return data({ error: message }, { status: 400 });
    }
  }

  return data({ error: "Unknown intent" }, { status: 400 });
}

export default function FormDesignerPage() {
  const { template, fieldDefinitions, sectionTemplates } = useLoaderData<typeof loader>();
  const params = useParams();
  const basePrefix = `/${params.tenant}`;

  const initialDefinition = resolveDefinition(template.definition);
  const designer = useFormDesigner(initialDefinition);
  const { state, canUndo, canRedo, undo, redo } = designer;

  const saveFetcher = useFetcher();
  const isSaving = saveFetcher.state !== "idle";
  const lastSavedAtRef = useRef<Date | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const persistDefinition = useCallback(
    (definition: FormDefinition) => {
      const formData = new FormData();
      formData.set("intent", "save-definition");
      formData.set("definition", JSON.stringify(definition));
      saveFetcher.submit(formData, { method: "POST" });
    },
    [saveFetcher],
  );

  const handleSaveNow = useCallback(() => {
    persistDefinition(state.definition);
    designer.markSaved();
    lastSavedAtRef.current = new Date();
    setLastSavedAt(new Date());
  }, [persistDefinition, state.definition, designer]);

  // Autosave: debounce 2s after any change
  useEffect(() => {
    if (!state.isDirty) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      persistDefinition(state.definition);
      designer.markSaved();
      lastSavedAtRef.current = new Date();
      setLastSavedAt(new Date());
    }, 2000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [state.isDirty, state.definition, persistDefinition, designer]);

  const saveStatus = isSaving ? "saving" : state.isDirty ? "unsaved" : "saved";

  const saveTemplateFetcher = useFetcher();
  const [saveTemplateSection, setSaveTemplateSection] = useState<FormSection | null>(null);

  const publishFetcher = useFetcher();
  const isPublishing = publishFetcher.state !== "idle";

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (mod && e.key === "s") {
        e.preventDefault();
        handleSaveNow();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, handleSaveNow]);

  const activePage = state.definition.pages.find((p) => p.id === state.activePageId);
  const selectedSection =
    state.selectedElementType === "section" && state.selectedElementId
      ? activePage?.sections.find((s) => s.id === state.selectedElementId)
      : null;
  const activeSectionId = selectedSection?.id ?? null;

  const handleAddField = useCallback(
    (fieldDefinitionId: string) => {
      if (!state.activePageId || !activeSectionId) return;
      const section = activePage?.sections.find((s) => s.id === activeSectionId);
      const order = section?.fields.length ?? 0;
      designer.addField(state.activePageId, activeSectionId, {
        id: generateId("field"),
        fieldDefinitionId,
        order,
      });
    },
    [state.activePageId, activeSectionId, activePage, designer],
  );

  const handleAddFieldFromPalette = useCallback(
    (fieldDefinitionId: string, targetSectionId: string, order: number) => {
      if (!state.activePageId) return;
      designer.addField(state.activePageId, targetSectionId, {
        id: generateId("field"),
        fieldDefinitionId,
        order,
      });
    },
    [state.activePageId, designer],
  );

  const handleAddSection = useCallback(
    (pageId: string) => {
      const page = state.definition.pages.find((p) => p.id === pageId);
      const order = page?.sections.length ?? 0;
      designer.addSection(pageId, {
        id: generateId("section"),
        title: `Section ${order + 1}`,
        columns: 2,
        collapsible: false,
        order,
        fields: [],
      });
    },
    [state.definition.pages, designer],
  );

  const handleAddPage = useCallback(() => {
    const order = state.definition.pages.length;
    designer.addPage({
      id: generateId("page"),
      title: `Page ${order + 1}`,
      order,
      sections: [],
    });
  }, [state.definition.pages.length, designer]);

  const handleAddSectionFromTemplate = useCallback(
    (tmpl: SectionTemplateItem) => {
      if (!state.activePageId) return;
      const def = tmpl.definition as FormSection | null;
      if (!def) return;
      const page = state.definition.pages.find((p) => p.id === state.activePageId);
      const order = page?.sections.length ?? 0;
      const sectionId = generateId("section");

      const fields = (def.fields ?? []).map((f, i) => ({
        id: generateId("field"),
        fieldDefinitionId: f.fieldDefinitionId,
        colSpan: f.colSpan,
        order: i,
      }));

      designer.addSection(state.activePageId, {
        id: sectionId,
        title: def.title,
        description: def.description,
        columns: def.columns,
        collapsible: def.collapsible,
        defaultCollapsed: def.defaultCollapsed,
        order,
        fields,
      });
    },
    [state.activePageId, state.definition.pages, designer],
  );

  const handleSaveAsTemplate = useCallback((section: FormSection) => {
    setSaveTemplateSection(section);
  }, []);

  const handleConfirmSaveTemplate = useCallback(
    async (name: string, description: string) => {
      if (!saveTemplateSection) return;
      const formData = new FormData();
      formData.set("intent", "save-template");
      formData.set("name", name);
      formData.set("description", description);
      formData.set("definition", JSON.stringify(saveTemplateSection));
      saveTemplateFetcher.submit(formData, { method: "POST" });
      setSaveTemplateSection(null);
    },
    [saveTemplateSection, saveTemplateFetcher],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild className="size-8 shrink-0">
                  <Link to={`${basePrefix}/forms`}>
                    <ArrowLeft className="size-4" />
                  </Link>
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>{template.name}</CardTitle>
                    <Badge
                      variant={template.status === "PUBLISHED" ? "outline" : "secondary"}
                      className={
                        template.status === "PUBLISHED"
                          ? "border-green-500 text-green-700 dark:text-green-400"
                          : undefined
                      }
                    >
                      {template.status}
                    </Badge>
                    <Badge variant="secondary">{template.entityType}</Badge>
                  </div>
                  <CardDescription>
                    Design and customize your form with drag-and-drop fields, sections, and pages.
                  </CardDescription>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AutosaveIndicator status={saveStatus as AutosaveStatus} lastSavedAt={lastSavedAt} />

              <Separator orientation="vertical" className="hidden h-6 sm:block" />

              <Button variant="outline" size="sm" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)">
                <Redo2 className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="hidden h-6 sm:block" />

              <div className="flex items-center rounded-md border">
                <Button
                  variant={state.viewMode === "editor" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => designer.setViewMode("editor" as ViewMode)}
                  title="Editor"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={state.viewMode === "split" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-none border-x"
                  onClick={() => designer.setViewMode("split" as ViewMode)}
                  title="Split"
                >
                  <Columns2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={state.viewMode === "preview" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => designer.setViewMode("preview" as ViewMode)}
                  title="Preview"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="hidden h-6 sm:block" />

              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveNow}
                disabled={saveStatus === "saved" || saveStatus === "saving"}
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                size="sm"
                disabled={isPublishing}
                onClick={() => {
                  const formData = new FormData();
                  formData.set(
                    "intent",
                    template.status === "PUBLISHED" ? "unpublish" : "publish",
                  );
                  publishFetcher.submit(formData, { method: "POST" });
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isPublishing
                  ? template.status === "PUBLISHED"
                    ? "Unpublishing..."
                    : "Publishing..."
                  : template.status === "PUBLISHED"
                    ? "Unpublish"
                    : "Publish"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <DndDesignerContext
        definition={state.definition}
        activePageId={state.activePageId}
        fieldDefinitions={fieldDefinitions}
        onMoveField={designer.moveField}
        onReorderSections={designer.reorderSections}
        onAddFieldFromPalette={handleAddFieldFromPalette}
      >
        <div className="flex h-[calc(100vh-14rem)] gap-4">
          {state.viewMode !== "preview" && (
            <Card className="w-72 shrink-0 gap-0 overflow-hidden py-0">
              <CardContent className="h-full overflow-y-auto p-0">
                <FieldPalette
                  fields={fieldDefinitions}
                  fieldsUrl={`${basePrefix}/settings/fields`}
                  activePageId={state.activePageId}
                  activeSectionId={activeSectionId}
                  onAddField={handleAddField}
                  sectionTemplates={sectionTemplates}
                  onAddSectionFromTemplate={handleAddSectionFromTemplate}
                />
              </CardContent>
            </Card>
          )}

          <Card className="min-w-0 flex-1 gap-0 overflow-hidden py-0">
            <CardContent className="h-full p-0">
              <div
                className={cn(
                  "flex h-full overflow-hidden",
                  state.viewMode === "split" && "divide-x",
                )}
              >
                {state.viewMode !== "preview" && (
                  <div className="flex-1 overflow-hidden">
                    <DesignCanvas
                      definition={state.definition}
                      activePageId={state.activePageId}
                      selectedElementId={state.selectedElementId}
                      selectedElementType={state.selectedElementType}
                      fieldDefinitions={fieldDefinitions}
                      onSelectElement={designer.selectElement}
                      onSetActivePage={designer.setActivePage}
                      onAddPage={handleAddPage}
                      onRemovePage={designer.removePage}
                      onUpdatePage={designer.updatePage}
                      onDuplicatePage={() => {
                        /* duplicate not yet in hook */
                      }}
                      onReorderPages={designer.reorderPages}
                      onAddSection={handleAddSection}
                      onRemoveSection={designer.removeSection}
                      onUpdateSection={designer.updateSection}
                      onReorderSections={designer.reorderSections}
                      onRemoveField={designer.removeField}
                      onSaveAsTemplate={handleSaveAsTemplate}
                    />
                  </div>
                )}

                {(state.viewMode === "preview" || state.viewMode === "split") && (
                  <div className="flex-1 overflow-y-auto bg-muted/30">
                    <FormPreview
                      definition={state.definition}
                      fieldDefinitions={fieldDefinitions}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {state.viewMode !== "preview" && (
            <Card className="w-80 shrink-0 gap-0 overflow-hidden py-0">
              <CardContent className="h-full overflow-y-auto p-0">
                <PropertiesPanel
                  definition={state.definition}
                  selectedElementId={state.selectedElementId}
                  selectedElementType={state.selectedElementType}
                  fieldDefinitions={fieldDefinitions}
                  onUpdatePage={designer.updatePage}
                  onUpdateSection={designer.updateSection}
                  onUpdateField={designer.updateField}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </DndDesignerContext>

      <SaveTemplateDialog
        open={saveTemplateSection !== null}
        onOpenChange={(open) => {
          if (!open) setSaveTemplateSection(null);
        }}
        defaultName={saveTemplateSection?.title ?? ""}
        onSave={handleConfirmSaveTemplate}
      />
    </div>
  );
}
