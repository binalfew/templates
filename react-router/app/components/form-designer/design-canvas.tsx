import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Layers,
  LayoutGrid,
  Trash2,
  ChevronDown,
  Pencil,
  Copy,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ConfirmDialog } from "./confirm-dialog";
import { SortableSection } from "./sortable-section";
import { makeSectionDndId } from "./dnd-designer-context";
import { cn } from "~/utils/misc";
import type { FormDefinition, FormPage, FormSection } from "~/types/form-designer";
import type { SelectedElementType } from "~/types/designer-state";

interface FieldDefinitionLookup {
  id: string;
  label: string;
  dataType: string;
  name: string;
}

interface DesignCanvasProps {
  definition: FormDefinition;
  activePageId: string | null;
  selectedElementId: string | null;
  selectedElementType: SelectedElementType;
  fieldDefinitions: FieldDefinitionLookup[];
  onSelectElement: (id: string | null, type: SelectedElementType) => void;
  onSetActivePage: (pageId: string) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
  onUpdatePage: (pageId: string, updates: Partial<Omit<FormPage, "id" | "sections">>) => void;
  onDuplicatePage: (pageId: string) => void;
  onReorderPages: (fromIndex: number, toIndex: number) => void;
  onAddSection: (pageId: string) => void;
  onRemoveSection: (pageId: string, sectionId: string) => void;
  onUpdateSection: (
    pageId: string,
    sectionId: string,
    updates: Partial<Omit<FormSection, "id" | "fields">>,
  ) => void;
  onReorderSections: (pageId: string, fromIndex: number, toIndex: number) => void;
  onRemoveField: (pageId: string, sectionId: string, fieldId: string) => void;
  onSaveAsTemplate?: (section: FormSection) => void;
}

export function DesignCanvas({
  definition,
  activePageId,
  selectedElementId,
  selectedElementType,
  fieldDefinitions,
  onSelectElement,
  onSetActivePage,
  onAddPage,
  onRemovePage,
  onUpdatePage,
  onDuplicatePage,
  onReorderPages,
  onAddSection,
  onRemoveSection,
  onUpdateSection,
  onReorderSections,
  onRemoveField,
  onSaveAsTemplate,
}: DesignCanvasProps) {
  const fdMap = new Map(fieldDefinitions.map((fd) => [fd.id, fd]));

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageTitle, setEditingPageTitle] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [confirmDelete, setConfirmDelete] = useState<{
    type: "page" | "section";
    pageId: string;
    sectionId?: string;
    title: string;
    fieldCount: number;
  } | null>(null);

  useEffect(() => {
    if (editingPageId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingPageId]);

  const commitRename = useCallback(() => {
    if (editingPageId && editingPageTitle.trim()) {
      onUpdatePage(editingPageId, { title: editingPageTitle.trim() });
    }
    setEditingPageId(null);
  }, [editingPageId, editingPageTitle, onUpdatePage]);

  const startRename = useCallback((page: FormPage) => {
    setEditingPageId(page.id);
    setEditingPageTitle(page.title);
  }, []);

  const handleDeletePage = useCallback(
    (pageId: string) => {
      const page = definition.pages.find((p) => p.id === pageId);
      if (!page) return;
      const fieldCount = page.sections.reduce((acc, s) => acc + s.fields.length, 0);
      if (fieldCount > 0) {
        setConfirmDelete({ type: "page", pageId, title: page.title, fieldCount });
      } else {
        onRemovePage(pageId);
      }
    },
    [definition.pages, onRemovePage],
  );

  const handleDeleteSection = useCallback(
    (pageId: string, sectionId: string) => {
      const page = definition.pages.find((p) => p.id === pageId);
      const section = page?.sections.find((s) => s.id === sectionId);
      if (!section) return;
      if (section.fields.length > 0) {
        setConfirmDelete({
          type: "section",
          pageId,
          sectionId,
          title: section.title,
          fieldCount: section.fields.length,
        });
      } else {
        onRemoveSection(pageId, sectionId);
      }
    },
    [definition.pages, onRemoveSection],
  );

  const confirmDeleteAction = useCallback(() => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "page") {
      onRemovePage(confirmDelete.pageId);
    } else if (confirmDelete.sectionId) {
      onRemoveSection(confirmDelete.pageId, confirmDelete.sectionId);
    }
    setConfirmDelete(null);
  }, [confirmDelete, onRemovePage, onRemoveSection]);

  if (definition.pages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Layers className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No pages yet</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onAddPage}>
            <Plus className="size-3.5" />
            Add First Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Tabs
        value={activePageId ?? undefined}
        onValueChange={onSetActivePage}
        className="flex flex-col overflow-hidden"
      >
        <div className="flex items-center border-b bg-muted/30 px-3">
          <TabsList className="h-8 bg-transparent p-0">
            {definition.pages.map((page, pageIndex) => (
              <TabsTrigger
                key={page.id}
                value={page.id}
                className="group/tab relative h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                onDoubleClick={() => startRename(page)}
              >
                {editingPageId === page.id ? (
                  <input
                    ref={renameInputRef}
                    value={editingPageTitle}
                    onChange={(e) => setEditingPageTitle(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingPageId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-5 w-24 rounded border bg-background px-1 text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <span className="flex items-center gap-1">
                    {page.title}
                    {activePageId === page.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <span
                            role="button"
                            tabIndex={0}
                            className="ml-0.5 hidden cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground group-data-[state=active]/tab:inline-flex"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.currentTarget.click();
                              }
                            }}
                          >
                            <ChevronDown className="size-3" />
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          <DropdownMenuItem onClick={() => startRename(page)}>
                            <Pencil className="size-3.5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDuplicatePage(page.id)}>
                            <Copy className="size-3.5" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={pageIndex === 0}
                            onClick={() => onReorderPages(pageIndex, pageIndex - 1)}
                          >
                            <ArrowLeft className="size-3.5" />
                            Move Left
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={pageIndex === definition.pages.length - 1}
                            onClick={() => onReorderPages(pageIndex, pageIndex + 1)}
                          >
                            <ArrowRight className="size-3.5" />
                            Move Right
                          </DropdownMenuItem>
                          {definition.pages.length > 1 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDeletePage(page.id)}
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            variant="ghost"
            size="icon-xs"
            className="ml-1"
            onClick={onAddPage}
            title="Add page"
          >
            <Plus className="size-3" />
          </Button>
        </div>

        {definition.pages.map((page) => (
          <TabsContent key={page.id} value={page.id} className="flex-1 overflow-y-auto p-4">
            <PageContent
              page={page}
              fdMap={fdMap}
              selectedElementId={selectedElementId}
              selectedElementType={selectedElementType}
              onSelectElement={onSelectElement}
              onAddSection={() => onAddSection(page.id)}
              onRemoveSection={(sectionId) => handleDeleteSection(page.id, sectionId)}
              onUpdateSection={(sectionId, updates) => onUpdateSection(page.id, sectionId, updates)}
              onReorderSections={(fromIndex, toIndex) =>
                onReorderSections(page.id, fromIndex, toIndex)
              }
              onRemoveField={(sectionId, fieldId) => onRemoveField(page.id, sectionId, fieldId)}
              onSaveAsTemplate={onSaveAsTemplate}
            />
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title={`Delete ${confirmDelete?.type === "page" ? "page" : "section"}?`}
        description={
          confirmDelete
            ? `"${confirmDelete.title}" contains ${confirmDelete.fieldCount} field${confirmDelete.fieldCount === 1 ? "" : "s"}. This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteAction}
      />
    </div>
  );
}

interface PageContentProps {
  page: FormPage;
  fdMap: Map<string, FieldDefinitionLookup>;
  selectedElementId: string | null;
  selectedElementType: SelectedElementType;
  onSelectElement: (id: string | null, type: SelectedElementType) => void;
  onAddSection: () => void;
  onRemoveSection: (sectionId: string) => void;
  onUpdateSection: (
    sectionId: string,
    updates: Partial<Omit<FormSection, "id" | "fields">>,
  ) => void;
  onReorderSections: (fromIndex: number, toIndex: number) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
  onSaveAsTemplate?: (section: FormSection) => void;
}

function PageContent({
  page,
  fdMap,
  selectedElementId,
  selectedElementType,
  onSelectElement,
  onAddSection,
  onRemoveSection,
  onUpdateSection,
  onReorderSections,
  onRemoveField,
  onSaveAsTemplate,
}: PageContentProps) {
  if (page.sections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <LayoutGrid className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No sections in this page</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onAddSection}>
            <Plus className="size-3.5" />
            Add Section
          </Button>
        </div>
      </div>
    );
  }

  const sorted = [...page.sections].sort((a, b) => a.order - b.order);
  const sectionDndIds = sorted.map((s) => makeSectionDndId(s.id));

  return (
    <div className="space-y-4">
      <SortableContext items={sectionDndIds} strategy={verticalListSortingStrategy}>
        {sorted.map((section, index) => (
          <SortableSection
            key={section.id}
            section={section}
            sectionIndex={index}
            totalSections={sorted.length}
            fdMap={fdMap}
            isSelected={selectedElementId === section.id && selectedElementType === "section"}
            selectedFieldId={selectedElementType === "field" ? selectedElementId : null}
            onSelectSection={() => onSelectElement(section.id, "section")}
            onSelectField={(fieldId) => onSelectElement(fieldId, "field")}
            onRemoveSection={() => onRemoveSection(section.id)}
            onUpdateSection={(updates) => onUpdateSection(section.id, updates)}
            onMoveUp={() => onReorderSections(index, index - 1)}
            onMoveDown={() => onReorderSections(index, index + 1)}
            onRemoveField={(fieldId) => onRemoveField(section.id, fieldId)}
            onSaveAsTemplate={onSaveAsTemplate ? () => onSaveAsTemplate(section) : undefined}
          />
        ))}
      </SortableContext>
      <div className="flex justify-center pt-2">
        <Button variant="outline" size="sm" onClick={onAddSection}>
          <Plus className="size-3.5" />
          Add Section
        </Button>
      </div>
    </div>
  );
}
