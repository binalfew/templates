import type { ReactNode } from "react";

interface GalleryGridProps<T> {
  items: T[];
  renderCard: (item: T) => ReactNode;
  renderActions?: (item: T) => ReactNode;
  columns?: 1 | 2 | 3 | 4;
}

const gridColsClass: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

export function GalleryGrid<T>({ items, renderCard, renderActions, columns = 3 }: GalleryGridProps<T>) {
  return (
    <div className={`grid gap-4 ${gridColsClass[columns]}`}>
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">{renderCard(item)}</div>
            {renderActions && (
              <div className="shrink-0">{renderActions(item)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
