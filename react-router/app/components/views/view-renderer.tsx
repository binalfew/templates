import type { ReactNode } from "react";
import type { ViewType } from "~/generated/prisma/client.js";
import { KanbanBoard } from "./kanban-board";
import { CalendarView } from "./calendar-view";
import { GalleryGrid } from "./gallery-grid";

interface EntityConfig<T> {
  kanban?: {
    groupBy: string;
    getGroupValue: (item: T) => string;
    renderCard: (item: T) => ReactNode;
    columnOrder?: string[];
  };
  calendar?: {
    getDate: (item: T) => string | Date;
    renderItem: (item: T) => ReactNode;
  };
  gallery?: {
    renderCard: (item: T) => ReactNode;
    columns?: 1 | 2 | 3 | 4;
  };
}

interface ViewRendererProps<T> {
  items: T[];
  viewType: ViewType | null;
  entityConfig: EntityConfig<T>;
  defaultRenderer: () => ReactNode;
}

export function ViewRenderer<T>({
  items,
  viewType,
  entityConfig,
  defaultRenderer,
}: ViewRendererProps<T>) {
  // No view or TABLE type — use the default renderer
  if (!viewType || viewType === "TABLE") {
    return <>{defaultRenderer()}</>;
  }

  if (viewType === "KANBAN" && entityConfig.kanban) {
    return (
      <KanbanBoard
        items={items}
        groupBy={entityConfig.kanban.groupBy}
        getGroupValue={entityConfig.kanban.getGroupValue}
        renderCard={entityConfig.kanban.renderCard}
        columnOrder={entityConfig.kanban.columnOrder}
      />
    );
  }

  if (viewType === "CALENDAR" && entityConfig.calendar) {
    return (
      <CalendarView
        items={items}
        getDate={entityConfig.calendar.getDate}
        renderItem={entityConfig.calendar.renderItem}
      />
    );
  }

  if (viewType === "GALLERY" && entityConfig.gallery) {
    return (
      <GalleryGrid
        items={items}
        renderCard={entityConfig.gallery.renderCard}
        columns={entityConfig.gallery.columns}
      />
    );
  }

  // View type not supported for this entity — fall back to default
  return <>{defaultRenderer()}</>;
}
