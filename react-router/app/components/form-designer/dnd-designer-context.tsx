import { useState, useCallback, useId, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { getFieldTypeIcon } from "./field-type-icons";
import type { FormDefinition, FormFieldPlacement } from "~/types/form-designer";

// ─── DnD item type prefixes ──────────────────────────────

export const DND_PREFIX = {
  SECTION: "section:",
  FIELD: "field:",
  PALETTE: "palette:",
} as const;

export function makeSectionDndId(sectionId: string) {
  return `${DND_PREFIX.SECTION}${sectionId}`;
}

export function makeFieldDndId(fieldId: string) {
  return `${DND_PREFIX.FIELD}${fieldId}`;
}

export function makePaletteDndId(fieldDefinitionId: string) {
  return `${DND_PREFIX.PALETTE}${fieldDefinitionId}`;
}

export function parseDndId(dndId: UniqueIdentifier): {
  type: "section" | "field" | "palette";
  id: string;
} | null {
  const str = String(dndId);
  if (str.startsWith(DND_PREFIX.SECTION)) {
    return { type: "section", id: str.slice(DND_PREFIX.SECTION.length) };
  }
  if (str.startsWith(DND_PREFIX.FIELD)) {
    return { type: "field", id: str.slice(DND_PREFIX.FIELD.length) };
  }
  if (str.startsWith(DND_PREFIX.PALETTE)) {
    return { type: "palette", id: str.slice(DND_PREFIX.PALETTE.length) };
  }
  return null;
}

// ─── Types ──────────────────────────────────────────────

interface FieldDefinitionLookup {
  id: string;
  label: string;
  dataType: string;
  name: string;
}

export interface ActiveDragInfo {
  type: "section" | "field" | "palette";
  id: string;
  label?: string;
  dataType?: string;
  colSpan?: number;
}

interface DndDesignerContextProps {
  definition: FormDefinition;
  activePageId: string | null;
  fieldDefinitions: FieldDefinitionLookup[];
  onMoveField: (
    fromPageId: string,
    fromSectionId: string,
    toPageId: string,
    toSectionId: string,
    fieldId: string,
    newOrder: number,
  ) => void;
  onReorderSections: (pageId: string, fromIndex: number, toIndex: number) => void;
  onAddFieldFromPalette: (
    fieldDefinitionId: string,
    targetSectionId: string,
    order: number,
  ) => void;
  children: React.ReactNode;
}

const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;
  return closestCenter(args);
};

export function DndDesignerContext({
  definition,
  activePageId,
  fieldDefinitions,
  onMoveField,
  onReorderSections,
  onAddFieldFromPalette,
  children,
}: DndDesignerContextProps) {
  const dndContextId = useId();
  const [activeDrag, setActiveDrag] = useState<ActiveDragInfo | null>(null);
  const [_overId, setOverId] = useState<UniqueIdentifier | null>(null);

  const fdMap = useMemo(
    () => new Map(fieldDefinitions.map((fd) => [fd.id, fd])),
    [fieldDefinitions],
  );

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, keyboardSensor, touchSensor);

  const activePage = definition.pages.find((p) => p.id === activePageId);

  const findFieldLocation = useCallback(
    (fieldId: string) => {
      if (!activePage) return null;
      for (const section of activePage.sections) {
        const fieldIndex = section.fields.findIndex((f) => f.id === fieldId);
        if (fieldIndex !== -1) {
          return { section, fieldIndex };
        }
      }
      return null;
    },
    [activePage],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const parsed = parseDndId(event.active.id);
      if (!parsed) return;

      if (parsed.type === "section") {
        setActiveDrag({ type: "section", id: parsed.id });
      } else if (parsed.type === "field") {
        const loc = findFieldLocation(parsed.id);
        const field = loc?.section.fields[loc.fieldIndex];
        const fd = field ? fdMap.get(field.fieldDefinitionId) : undefined;
        setActiveDrag({
          type: "field",
          id: parsed.id,
          label: fd?.label ?? "Field",
          dataType: fd?.dataType ?? "TEXT",
          colSpan: field?.colSpan,
        });
      } else if (parsed.type === "palette") {
        const fd = fdMap.get(parsed.id);
        setActiveDrag({
          type: "palette",
          id: parsed.id,
          label: fd?.label ?? "Field",
          dataType: fd?.dataType ?? "TEXT",
        });
      }
    },
    [findFieldLocation, fdMap],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      setOverId(null);

      const { active, over } = event;
      if (!over || !activePageId || !activePage) return;

      const activeParsed = parseDndId(active.id);
      const overParsed = parseDndId(over.id);
      if (!activeParsed || !overParsed) return;

      if (activeParsed.type === "section" && overParsed.type === "section") {
        const sorted = [...activePage.sections].sort((a, b) => a.order - b.order);
        const fromIndex = sorted.findIndex((s) => s.id === activeParsed.id);
        const toIndex = sorted.findIndex((s) => s.id === overParsed.id);
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          onReorderSections(activePageId, fromIndex, toIndex);
        }
        return;
      }

      if (activeParsed.type === "field") {
        const sourceLoc = findFieldLocation(activeParsed.id);
        if (!sourceLoc) return;

        let targetSectionId: string;
        let targetOrder: number;

        if (overParsed.type === "field") {
          const targetLoc = findFieldLocation(overParsed.id);
          if (!targetLoc) return;
          targetSectionId = targetLoc.section.id;
          targetOrder = targetLoc.fieldIndex;
        } else if (overParsed.type === "section") {
          const targetSection = activePage.sections.find((s) => s.id === overParsed.id);
          if (!targetSection) return;
          targetSectionId = targetSection.id;
          targetOrder = targetSection.fields.length;
        } else {
          return;
        }

        if (sourceLoc.section.id === targetSectionId && sourceLoc.fieldIndex === targetOrder) {
          return;
        }

        onMoveField(
          activePageId,
          sourceLoc.section.id,
          activePageId,
          targetSectionId,
          activeParsed.id,
          targetOrder,
        );
        return;
      }

      if (activeParsed.type === "palette") {
        let targetSectionId: string;
        let targetOrder: number;

        if (overParsed.type === "field") {
          const targetLoc = findFieldLocation(overParsed.id);
          if (!targetLoc) return;
          targetSectionId = targetLoc.section.id;
          targetOrder = targetLoc.fieldIndex;
        } else if (overParsed.type === "section") {
          const targetSection = activePage.sections.find((s) => s.id === overParsed.id);
          if (!targetSection) return;
          targetSectionId = targetSection.id;
          targetOrder = targetSection.fields.length;
        } else {
          return;
        }

        onAddFieldFromPalette(activeParsed.id, targetSectionId, targetOrder);
      }
    },
    [activePageId, activePage, findFieldLocation, onMoveField, onReorderSections, onAddFieldFromPalette],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
    setOverId(null);
  }, []);

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeDrag && <DragOverlayContent drag={activeDrag} />}
      </DragOverlay>
    </DndContext>
  );
}

function DragOverlayContent({ drag }: { drag: ActiveDragInfo }) {
  if (drag.type === "section") {
    return (
      <div className="rounded-lg border-2 border-primary/50 bg-card px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GripVertical className="size-4 text-muted-foreground" />
          Section
        </div>
      </div>
    );
  }

  const Icon = getFieldTypeIcon(drag.dataType ?? "TEXT");
  return (
    <div className="flex items-center gap-2 rounded border-2 border-primary/50 bg-background px-2.5 py-2 text-xs shadow-lg">
      <GripVertical className="size-3 text-muted-foreground" />
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{drag.label ?? "Field"}</span>
    </div>
  );
}
