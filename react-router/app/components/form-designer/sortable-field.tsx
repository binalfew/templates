import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Eye } from "lucide-react";
import { cn } from "~/lib/utils";
import { getFieldTypeIcon } from "./field-type-icons";
import { makeFieldDndId } from "./dnd-designer-context";
import type { FormFieldPlacement } from "~/types/form-designer";

interface FieldDefinitionLookup {
  id: string;
  label: string;
  dataType: string;
  name: string;
}

interface SortableFieldProps {
  field: FormFieldPlacement;
  fdLookup: FieldDefinitionLookup | undefined;
  isSelected: boolean;
  colSpan: number;
  onClick: (e: React.MouseEvent) => void;
  onRemove: (e: React.MouseEvent) => void;
}

export function SortableField({
  field,
  fdLookup,
  isSelected,
  colSpan,
  onClick,
  onRemove,
}: SortableFieldProps) {
  const dndId = makeFieldDndId(field.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dndId,
    data: { type: "field", fieldId: field.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${Math.min(Math.max(colSpan, 1), 12)}`,
  };

  const Icon = getFieldTypeIcon(fdLookup?.dataType ?? "TEXT");
  const label = fdLookup?.label ?? "Unknown field";
  const hasCondition = !!field.visibleIf;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex cursor-pointer items-center gap-1.5 rounded border bg-background px-2 py-2 text-xs transition-colors hover:border-primary/50",
        isSelected && "ring-2 ring-primary border-primary",
        isDragging && "opacity-30 ring-2 ring-primary/30",
      )}
      onClick={onClick}
    >
      <button
        className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </button>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
      {hasCondition && (
        <span title="Has visibility condition">
          <Eye className="size-3 shrink-0 text-amber-500" />
        </span>
      )}
      <button
        className="ml-auto hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
        onClick={onRemove}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}
