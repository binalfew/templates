import { useCallback, useReducer, useRef } from "react";
import type { FormDefinition } from "~/types/form-designer";
import type { DesignerState, DesignerAction } from "~/types/designer-state";

const MAX_UNDO_STACK = 50;

function normalizeDefinition(def: FormDefinition | undefined | null): FormDefinition {
  if (!def || !def.pages || def.pages.length === 0) {
    return { pages: [] };
  }
  return def;
}

function createInitialState(definition: FormDefinition | undefined | null): DesignerState {
  const normalized = normalizeDefinition(definition);
  return {
    definition: normalized,
    selectedElementId: null,
    selectedElementType: null,
    activePageId: normalized.pages[0]?.id ?? null,
    viewMode: "editor",
    isDirty: false,
  };
}

export function designerReducer(state: DesignerState, action: DesignerAction): DesignerState {
  switch (action.type) {
    case "SET_DEFINITION": {
      const normalized = normalizeDefinition(action.definition);
      return {
        ...state,
        definition: normalized,
        activePageId: normalized.pages[0]?.id ?? null,
        selectedElementId: null,
        selectedElementType: null,
        isDirty: false,
      };
    }

    case "SELECT_ELEMENT":
      return {
        ...state,
        selectedElementId: action.elementId,
        selectedElementType: action.elementType,
      };

    case "SET_ACTIVE_PAGE":
      return { ...state, activePageId: action.pageId };

    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.viewMode };

    case "ADD_PAGE": {
      const def = structuredClone(state.definition);
      def.pages.push(action.page);
      return { ...state, definition: def, activePageId: action.page.id, isDirty: true };
    }

    case "REMOVE_PAGE": {
      const def = structuredClone(state.definition);
      def.pages = def.pages.filter((p) => p.id !== action.pageId);
      const newActivePageId =
        state.activePageId === action.pageId ? (def.pages[0]?.id ?? null) : state.activePageId;
      return {
        ...state,
        definition: def,
        activePageId: newActivePageId,
        selectedElementId:
          state.selectedElementId === action.pageId ? null : state.selectedElementId,
        selectedElementType:
          state.selectedElementId === action.pageId ? null : state.selectedElementType,
        isDirty: true,
      };
    }

    case "UPDATE_PAGE": {
      const def = structuredClone(state.definition);
      const page = def.pages.find((p) => p.id === action.pageId);
      if (!page) return state;
      Object.assign(page, action.updates);
      return { ...state, definition: def, isDirty: true };
    }

    case "ADD_SECTION": {
      const def = structuredClone(state.definition);
      const page = def.pages.find((p) => p.id === action.pageId);
      if (!page) return state;
      page.sections.push(action.section);
      return { ...state, definition: def, isDirty: true };
    }

    case "REMOVE_SECTION": {
      const def = structuredClone(state.definition);
      const page = def.pages.find((p) => p.id === action.pageId);
      if (!page) return state;
      page.sections = page.sections.filter((s) => s.id !== action.sectionId);
      return {
        ...state,
        definition: def,
        selectedElementId:
          state.selectedElementId === action.sectionId ? null : state.selectedElementId,
        selectedElementType:
          state.selectedElementId === action.sectionId ? null : state.selectedElementType,
        isDirty: true,
      };
    }

    case "UPDATE_SECTION": {
      const def = structuredClone(state.definition);
      const page = def.pages.find((p) => p.id === action.pageId);
      if (!page) return state;
      const section = page.sections.find((s) => s.id === action.sectionId);
      if (!section) return state;
      Object.assign(section, action.updates);
      return { ...state, definition: def, isDirty: true };
    }

    case "ADD_FIELD": {
      const def = structuredClone(state.definition);
      const page = def.pages.find((p) => p.id === action.pageId);
      if (!page) return state;
      const section = page.sections.find((s) => s.id === action.sectionId);
      if (!section) return state;
      section.fields.push(action.field);
      return { ...state, definition: def, isDirty: true };
    }

    case "REMOVE_FIELD": {
      const def = structuredClone(state.definition);
      const page = def.pages.find((p) => p.id === action.pageId);
      if (!page) return state;
      const section = page.sections.find((s) => s.id === action.sectionId);
      if (!section) return state;
      section.fields = section.fields.filter((f) => f.id !== action.fieldId);
      return {
        ...state,
        definition: def,
        selectedElementId:
          state.selectedElementId === action.fieldId ? null : state.selectedElementId,
        selectedElementType:
          state.selectedElementId === action.fieldId ? null : state.selectedElementType,
        isDirty: true,
      };
    }

    case "UPDATE_FIELD": {
      const def = structuredClone(state.definition);
      const page = def.pages.find((p) => p.id === action.pageId);
      if (!page) return state;
      const section = page.sections.find((s) => s.id === action.sectionId);
      if (!section) return state;
      const field = section.fields.find((f) => f.id === action.fieldId);
      if (!field) return state;
      Object.assign(field, action.updates);
      return { ...state, definition: def, isDirty: true };
    }

    case "MOVE_FIELD": {
      const def = structuredClone(state.definition);
      const fromPage = def.pages.find((p) => p.id === action.fromPageId);
      if (!fromPage) return state;
      const fromSection = fromPage.sections.find((s) => s.id === action.fromSectionId);
      if (!fromSection) return state;
      const fieldIndex = fromSection.fields.findIndex((f) => f.id === action.fieldId);
      if (fieldIndex === -1) return state;

      const [field] = fromSection.fields.splice(fieldIndex, 1);

      const toPage = def.pages.find((p) => p.id === action.toPageId);
      if (!toPage) return state;
      const toSection = toPage.sections.find((s) => s.id === action.toSectionId);
      if (!toSection) return state;

      field.order = action.newOrder;
      toSection.fields.splice(action.newOrder, 0, field);

      toSection.fields.forEach((f, i) => { f.order = i; });
      if (action.fromSectionId !== action.toSectionId) {
        fromSection.fields.forEach((f, i) => { f.order = i; });
      }

      return { ...state, definition: def, isDirty: true };
    }

    case "REORDER_PAGES": {
      const { fromIndex, toIndex } = action;
      const def = structuredClone(state.definition);
      if (fromIndex < 0 || fromIndex >= def.pages.length || toIndex < 0 || toIndex >= def.pages.length || fromIndex === toIndex) {
        return state;
      }
      const [moved] = def.pages.splice(fromIndex, 1);
      def.pages.splice(toIndex, 0, moved);
      def.pages.forEach((p, i) => { p.order = i; });
      return { ...state, definition: def, isDirty: true };
    }

    case "REORDER_SECTIONS": {
      const { pageId, fromIndex, toIndex } = action;
      const def = structuredClone(state.definition);
      const page = def.pages.find((p) => p.id === pageId);
      if (!page) return state;
      if (fromIndex < 0 || fromIndex >= page.sections.length || toIndex < 0 || toIndex >= page.sections.length || fromIndex === toIndex) {
        return state;
      }
      const [moved] = page.sections.splice(fromIndex, 1);
      page.sections.splice(toIndex, 0, moved);
      page.sections.forEach((s, i) => { s.order = i; });
      return { ...state, definition: def, isDirty: true };
    }

    case "UPDATE_SETTINGS": {
      const def = structuredClone(state.definition);
      def.settings = { ...getDefaultSettings(), ...def.settings, ...action.settings };
      return { ...state, definition: def, isDirty: true };
    }

    case "MARK_SAVED":
      return { ...state, isDirty: false };

    default:
      return state;
  }
}

function getDefaultSettings() {
  return {
    displayMode: "wizard" as const,
    showProgressBar: true,
    submitButtonText: "Submit",
  };
}

const MUTATING_ACTIONS = new Set([
  "ADD_PAGE", "REMOVE_PAGE", "UPDATE_PAGE",
  "ADD_SECTION", "REMOVE_SECTION", "UPDATE_SECTION",
  "ADD_FIELD", "REMOVE_FIELD", "UPDATE_FIELD", "MOVE_FIELD",
  "REORDER_PAGES", "REORDER_SECTIONS", "UPDATE_SETTINGS",
]);

export function useFormDesigner(initialDefinition: FormDefinition | undefined | null) {
  const [state, rawDispatch] = useReducer(designerReducer, initialDefinition, createInitialState);

  const undoStack = useRef<DesignerState[]>([]);
  const redoStack = useRef<DesignerState[]>([]);

  const dispatch = useCallback(
    (action: DesignerAction) => {
      if (MUTATING_ACTIONS.has(action.type)) {
        undoStack.current = [...undoStack.current.slice(-MAX_UNDO_STACK + 1), state];
        redoStack.current = [];
      }
      rawDispatch(action);
    },
    [state],
  );

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const previous = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [...redoStack.current, state];
    rawDispatch({ type: "SET_DEFINITION", definition: previous.definition });
  }, [state]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current[redoStack.current.length - 1];
    redoStack.current = redoStack.current.slice(0, -1);
    undoStack.current = [...undoStack.current, state];
    rawDispatch({ type: "SET_DEFINITION", definition: next.definition });
  }, [state]);

  const selectElement = useCallback(
    (elementId: string | null, elementType: DesignerState["selectedElementType"]) => {
      dispatch({ type: "SELECT_ELEMENT", elementId, elementType });
    }, [dispatch]);

  const setActivePage = useCallback((pageId: string) => {
    dispatch({ type: "SET_ACTIVE_PAGE", pageId });
  }, [dispatch]);

  const setViewMode = useCallback((viewMode: DesignerState["viewMode"]) => {
    dispatch({ type: "SET_VIEW_MODE", viewMode });
  }, [dispatch]);

  const addPage = useCallback((page: FormDefinition["pages"][number]) => {
    dispatch({ type: "ADD_PAGE", page });
  }, [dispatch]);

  const removePage = useCallback((pageId: string) => {
    dispatch({ type: "REMOVE_PAGE", pageId });
  }, [dispatch]);

  const updatePage = useCallback(
    (pageId: string, updates: Partial<Omit<FormDefinition["pages"][number], "id" | "sections">>) => {
      dispatch({ type: "UPDATE_PAGE", pageId, updates });
    }, [dispatch]);

  const addSection = useCallback(
    (pageId: string, section: FormDefinition["pages"][number]["sections"][number]) => {
      dispatch({ type: "ADD_SECTION", pageId, section });
    }, [dispatch]);

  const removeSection = useCallback((pageId: string, sectionId: string) => {
    dispatch({ type: "REMOVE_SECTION", pageId, sectionId });
  }, [dispatch]);

  const updateSection = useCallback(
    (pageId: string, sectionId: string, updates: Partial<Omit<FormDefinition["pages"][number]["sections"][number], "id" | "fields">>) => {
      dispatch({ type: "UPDATE_SECTION", pageId, sectionId, updates });
    }, [dispatch]);

  const addField = useCallback(
    (pageId: string, sectionId: string, field: FormDefinition["pages"][number]["sections"][number]["fields"][number]) => {
      dispatch({ type: "ADD_FIELD", pageId, sectionId, field });
    }, [dispatch]);

  const removeField = useCallback((pageId: string, sectionId: string, fieldId: string) => {
    dispatch({ type: "REMOVE_FIELD", pageId, sectionId, fieldId });
  }, [dispatch]);

  const updateField = useCallback(
    (pageId: string, sectionId: string, fieldId: string, updates: Partial<Omit<FormDefinition["pages"][number]["sections"][number]["fields"][number], "id">>) => {
      dispatch({ type: "UPDATE_FIELD", pageId, sectionId, fieldId, updates });
    }, [dispatch]);

  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: "REORDER_PAGES", fromIndex, toIndex });
  }, [dispatch]);

  const reorderSections = useCallback((pageId: string, fromIndex: number, toIndex: number) => {
    dispatch({ type: "REORDER_SECTIONS", pageId, fromIndex, toIndex });
  }, [dispatch]);

  const moveField = useCallback(
    (fromPageId: string, fromSectionId: string, toPageId: string, toSectionId: string, fieldId: string, newOrder: number) => {
      dispatch({ type: "MOVE_FIELD", fromPageId, fromSectionId, toPageId, toSectionId, fieldId, newOrder });
    }, [dispatch]);

  const updateSettings = useCallback((settings: Partial<NonNullable<FormDefinition["settings"]>>) => {
    dispatch({ type: "UPDATE_SETTINGS", settings });
  }, [dispatch]);

  const markSaved = useCallback(() => {
    dispatch({ type: "MARK_SAVED" });
  }, [dispatch]);

  return {
    state, canUndo, canRedo, undo, redo,
    selectElement, setActivePage, setViewMode,
    addPage, removePage, updatePage,
    addSection, removeSection, updateSection,
    addField, removeField, updateField, moveField,
    reorderPages, reorderSections, updateSettings, markSaved,
  };
}
