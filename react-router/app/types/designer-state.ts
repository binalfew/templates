import type { FormDefinition, FormPage, FormSection, FormFieldPlacement } from "./form-designer";

// ─── View Modes ──────────────────────────────────────────

export type ViewMode = "editor" | "split" | "preview";

// ─── Selection Types ─────────────────────────────────────

export type SelectedElementType = "field" | "section" | "page" | null;

// ─── Designer State ──────────────────────────────────────

export interface DesignerState {
  definition: FormDefinition;
  selectedElementId: string | null;
  selectedElementType: SelectedElementType;
  activePageId: string | null;
  viewMode: ViewMode;
  isDirty: boolean;
}

// ─── Designer Actions (discriminated union) ──────────────

export type DesignerAction =
  | { type: "SET_DEFINITION"; definition: FormDefinition }
  | { type: "SELECT_ELEMENT"; elementId: string | null; elementType: SelectedElementType }
  | { type: "SET_ACTIVE_PAGE"; pageId: string }
  | { type: "SET_VIEW_MODE"; viewMode: ViewMode }
  // Page operations
  | { type: "ADD_PAGE"; page: FormPage }
  | { type: "REMOVE_PAGE"; pageId: string }
  | { type: "UPDATE_PAGE"; pageId: string; updates: Partial<Omit<FormPage, "id" | "sections">> }
  // Section operations
  | { type: "ADD_SECTION"; pageId: string; section: FormSection }
  | { type: "REMOVE_SECTION"; pageId: string; sectionId: string }
  | {
      type: "UPDATE_SECTION";
      pageId: string;
      sectionId: string;
      updates: Partial<Omit<FormSection, "id" | "fields">>;
    }
  // Field operations
  | { type: "ADD_FIELD"; pageId: string; sectionId: string; field: FormFieldPlacement }
  | { type: "REMOVE_FIELD"; pageId: string; sectionId: string; fieldId: string }
  | {
      type: "UPDATE_FIELD";
      pageId: string;
      sectionId: string;
      fieldId: string;
      updates: Partial<Omit<FormFieldPlacement, "id">>;
    }
  | {
      type: "MOVE_FIELD";
      fromPageId: string;
      fromSectionId: string;
      toPageId: string;
      toSectionId: string;
      fieldId: string;
      newOrder: number;
    }
  // Reorder operations
  | { type: "REORDER_PAGES"; fromIndex: number; toIndex: number }
  | { type: "REORDER_SECTIONS"; pageId: string; fromIndex: number; toIndex: number }
  // Settings
  | { type: "UPDATE_SETTINGS"; settings: Partial<NonNullable<FormDefinition["settings"]>> }
  // Save lifecycle
  | { type: "MARK_SAVED" };
