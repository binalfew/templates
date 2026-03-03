import type { ReactNode } from "react";
import { Badge } from "~/components/ui/badge";

interface KanbanBoardProps<T> {
  items: T[];
  groupBy: string;
  getGroupValue: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  renderActions?: (item: T) => ReactNode;
  columnOrder?: string[];
}

export function KanbanBoard<T>({
  items,
  groupBy,
  getGroupValue,
  renderCard,
  renderActions,
  columnOrder,
}: KanbanBoardProps<T>) {
  // Group items by the groupBy field value
  const groups = new Map<string, T[]>();

  // Initialize columns in order if provided
  if (columnOrder) {
    for (const col of columnOrder) {
      groups.set(col, []);
    }
  }

  for (const item of items) {
    const value = getGroupValue(item) || "Unassigned";
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value)!.push(item);
  }

  const columns = Array.from(groups.entries());

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
      {columns.map(([groupValue, groupItems]) => (
        <div
          key={groupValue}
          className="flex min-w-0 flex-col rounded-lg border bg-muted/30"
        >
          {/* Column header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">{groupValue}</h3>
            <Badge variant="secondary" className="text-xs">
              {groupItems.length}
            </Badge>
          </div>

          {/* Column content */}
          <div className="flex flex-col gap-2 p-3">
            {groupItems.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No items</p>
            ) : (
              groupItems.map((item, index) => (
                <div key={index} className="rounded-md border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">{renderCard(item)}</div>
                    {renderActions && (
                      <div className="shrink-0">{renderActions(item)}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
