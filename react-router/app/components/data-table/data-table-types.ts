import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface ColumnDef<TData> {
  id: string;
  header: string;
  cell: keyof TData | ((row: TData) => ReactNode);
  sortable?: boolean;
  visible?: boolean;
  align?: "left" | "center" | "right";
  hideOnMobile?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

export interface FilterDef {
  paramKey: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export interface ToolbarAction {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
}

export interface RowAction<TData> {
  label: string;
  icon?: LucideIcon;
  href?: (row: TData) => string;
  onClick?: (row: TData) => void;
  variant?: "default" | "destructive";
  visible?: (row: TData) => boolean;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  pageSizeOptions?: number[];
}

export interface EmptyStateConfig {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export interface ViewConfig<TData> {
  kanban?: {
    groupBy: string;
    getGroupValue: (item: TData) => string;
    renderCard: (item: TData) => ReactNode;
    columnOrder?: string[];
  };
  calendar?: {
    getDate: (item: TData) => string | Date;
    renderItem: (item: TData) => ReactNode;
  };
  gallery?: {
    renderCard: (item: TData) => ReactNode;
    columns?: 1 | 2 | 3 | 4;
  };
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  rowKey?: keyof TData | ((row: TData) => string);

  // Toolbar
  searchConfig?: { paramKey?: string; placeholder?: string };
  filters?: FilterDef[];
  toolbarActions?: ToolbarAction[];
  toolbarExtra?: ReactNode;

  // Row actions
  rowActions?: RowAction<TData>[];
  rowActionsStyle?: "dropdown" | "inline";

  // Pagination (server-side)
  pagination?: PaginationMeta;

  // Sorting (URL-driven)
  sortParams?: { fieldKey?: string; directionKey?: string };

  // Selection
  selectable?: boolean;
  onSelectionChange?: (selectedKeys: string[]) => void;
  bulkActions?: ToolbarAction[];

  // Empty state
  emptyState?: EmptyStateConfig;

  // View type (admin-defined display modes)
  viewType?: "TABLE" | "KANBAN" | "CALENDAR" | "GALLERY" | string | null;
  viewConfig?: ViewConfig<TData>;

  // Styling
  className?: string;
  showCount?: boolean;
}
