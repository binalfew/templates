import { useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Checkbox } from "~/components/ui/checkbox";
import { EmptyState } from "~/components/ui/empty-state";
import { cn } from "~/utils/utils";
import type { DataTableProps, ColumnDef } from "./data-table-types";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableRowActions } from "./data-table-row-actions";
import { DataTableToolbar } from "./data-table-toolbar";
import { KanbanBoard } from "~/components/views/kanban-board";
import { CalendarView } from "~/components/views/calendar-view";
import { GalleryGrid } from "~/components/views/gallery-grid";

function getRowKey<TData>(
  row: TData,
  rowKey: DataTableProps<TData>["rowKey"],
): string {
  if (typeof rowKey === "function") return rowKey(row);
  const key = rowKey ?? ("id" as keyof TData);
  return String((row as Record<string, unknown>)[key as string] ?? "");
}

function renderCell<TData>(column: ColumnDef<TData>, row: TData) {
  if (typeof column.cell === "function") {
    return column.cell(row);
  }
  const value = (row as Record<string, unknown>)[column.cell as string];
  return value != null ? String(value) : "";
}

export function DataTable<TData>({
  data,
  columns,
  rowKey,
  searchConfig,
  filters,
  toolbarActions,
  toolbarExtra,
  rowActions,
  rowActionsStyle = "dropdown",
  pagination,
  sortParams,
  selectable,
  onSelectionChange,
  bulkActions,
  emptyState,
  viewType,
  viewConfig,
  className,
  showCount,
}: DataTableProps<TData>) {
  const [searchParams] = useSearchParams();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const visibleColumns = columns.filter((col) => col.visible !== false);
  const hasRowActions = rowActions && rowActions.length > 0;

  const fieldKey = sortParams?.fieldKey ?? "sort";
  const directionKey = sortParams?.directionKey ?? "dir";

  const currentSort = searchParams.get(fieldKey);
  const currentDir = searchParams.get(directionKey);

  const updateSelection = useCallback(
    (next: Set<string>) => {
      setSelectedKeys(next);
      onSelectionChange?.(Array.from(next));
    },
    [onSelectionChange],
  );

  function toggleAll(checked: boolean) {
    if (checked) {
      const allKeys = new Set(data.map((row) => getRowKey(row, rowKey)));
      updateSelection(allKeys);
    } else {
      updateSelection(new Set());
    }
  }

  function toggleRow(key: string, checked: boolean) {
    const next = new Set(selectedKeys);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    updateSelection(next);
  }

  const allSelected = data.length > 0 && selectedKeys.size === data.length;
  const someSelected = selectedKeys.size > 0 && selectedKeys.size < data.length;

  const isAlternateView = viewType && viewType !== "TABLE";

  const renderItemActions = hasRowActions
    ? (item: TData) => (
        <DataTableRowActions row={item} actions={rowActions!} style={rowActionsStyle} />
      )
    : undefined;

  function renderContentArea() {
    if (isAlternateView && viewConfig) {
      if (viewType === "KANBAN" && viewConfig.kanban) {
        return (
          <KanbanBoard
            items={data}
            groupBy={viewConfig.kanban.groupBy}
            getGroupValue={viewConfig.kanban.getGroupValue}
            renderCard={viewConfig.kanban.renderCard}
            renderActions={renderItemActions}
            columnOrder={viewConfig.kanban.columnOrder}
          />
        );
      }
      if (viewType === "CALENDAR" && viewConfig.calendar) {
        return (
          <CalendarView
            items={data}
            getDate={viewConfig.calendar.getDate}
            renderItem={viewConfig.calendar.renderItem}
          />
        );
      }
      if (viewType === "GALLERY" && viewConfig.gallery) {
        return (
          <GalleryGrid
            items={data}
            renderCard={viewConfig.gallery.renderCard}
            renderActions={renderItemActions}
            columns={viewConfig.gallery.columns}
          />
        );
      }
    }

    // Default: table view
    return (
      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {visibleColumns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    col.hideOnMobile && "hidden md:table-cell",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                    col.headerClassName,
                  )}
                >
                  {col.sortable ? (
                    <DataTableColumnHeader
                      title={col.header}
                      field={col.id}
                      sortable
                      align={col.align}
                      fieldKey={fieldKey}
                      directionKey={directionKey}
                    />
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
              {hasRowActions && <TableHead className="w-10">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const key = getRowKey(row, rowKey);
              const isSelected = selectedKeys.has(key);

              return (
                <TableRow key={key} data-state={isSelected ? "selected" : undefined}>
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => toggleRow(key, checked === true)}
                        aria-label={`Select row ${key}`}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn(
                        col.hideOnMobile && "hidden md:table-cell",
                        col.align === "center" && "text-center",
                        col.align === "right" && "text-right",
                        col.cellClassName,
                      )}
                    >
                      {renderCell(col, row)}
                    </TableCell>
                  ))}
                  {hasRowActions && (
                    <TableCell className="text-right">
                      <DataTableRowActions
                        row={row}
                        actions={rowActions!}
                        style={rowActionsStyle}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Show empty state
  if (data.length === 0 && emptyState) {
    return (
      <div className={cn("space-y-4", className)}>
        <DataTableToolbar
          searchConfig={searchConfig}
          filters={filters}
          toolbarActions={toolbarActions}
          toolbarExtra={toolbarExtra}
          showCount={showCount}
          totalCount={0}
        />
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
          action={emptyState.action}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <DataTableToolbar
        searchConfig={searchConfig}
        filters={filters}
        toolbarActions={toolbarActions}
        toolbarExtra={toolbarExtra}
        selectedCount={selectedKeys.size}
        bulkActions={bulkActions}
        showCount={showCount}
        totalCount={pagination?.totalCount ?? data.length}
      />

      {renderContentArea()}

      {pagination && <DataTablePagination pagination={pagination} />}
    </div>
  );
}

export type { DataTableProps, ColumnDef } from "./data-table-types";
export type {
  FilterDef,
  ToolbarAction,
  RowAction,
  PaginationMeta,
  EmptyStateConfig,
  ViewConfig,
} from "./data-table-types";
