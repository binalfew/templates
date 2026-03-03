import type { SavedView } from "~/generated/prisma/client.js";
import {
  getView,
  getDefaultView,
  listViews,
  type SavedViewFilter,
  type SavedViewSort,
} from "~/services/saved-views.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";

/**
 * Mapping from filter field names to Prisma field paths.
 * Each entity page provides its own fieldMap.
 */
export type FieldMap = Record<string, string>;

interface ResolvedView {
  activeView: SavedView | null;
  availableViews: Awaited<ReturnType<typeof listViews>>;
}

/**
 * Reads `?viewId` from URL search params, falls back to user's default view.
 * Returns the active view (if any) and all available views for the entity type.
 */
export async function resolveActiveView(
  request: Request,
  tenantId: string,
  userId: string,
  entityType: string,
): Promise<ResolvedView> {
  const url = new URL(request.url);
  const viewId = url.searchParams.get("viewId");

  const availableViews = await listViews(tenantId, userId, entityType);

  let activeView: SavedView | null = null;

  if (viewId) {
    try {
      activeView = await getView(viewId);
    } catch {
      // View not found — fall through to default
    }
  }

  if (!activeView) {
    activeView = await getDefaultView(tenantId, userId, entityType);
  }

  return { activeView, availableViews };
}

/**
 * Translates SavedViewFilter[] into a Prisma `where` clause.
 * Supports operators: eq, neq, contains, gt, lt, gte, lte, in
 */
export function buildPrismaWhere(
  filters: SavedViewFilter[],
  fieldMap: FieldMap,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const filter of filters) {
    const prismaField = fieldMap[filter.field] ?? filter.field;
    const value = filter.value;

    switch (filter.operator) {
      case "eq":
        where[prismaField] = value;
        break;
      case "neq":
        where[prismaField] = { not: value };
        break;
      case "contains":
        where[prismaField] = { contains: String(value), mode: "insensitive" };
        break;
      case "gt":
        where[prismaField] = { gt: value };
        break;
      case "lt":
        where[prismaField] = { lt: value };
        break;
      case "gte":
        where[prismaField] = { gte: value };
        break;
      case "lte":
        where[prismaField] = { lte: value };
        break;
      case "in":
        where[prismaField] = { in: Array.isArray(value) ? value : [value] };
        break;
      default:
        // Unknown operator — treat as equality
        where[prismaField] = value;
    }
  }

  return where;
}

/**
 * Translates SavedViewSort[] into a Prisma `orderBy` array.
 */
export function buildPrismaOrderBy(
  sorts: SavedViewSort[],
  fieldMap: FieldMap,
): Array<Record<string, "asc" | "desc">> {
  return sorts.map((sort) => {
    const prismaField = fieldMap[sort.field] ?? sort.field;
    return { [prismaField]: sort.direction };
  });
}

// ─── View Context ────────────────────────────────────────

export interface AvailableView {
  id: string;
  name: string;
  viewType: string;
  isDefault: boolean;
  isShared: boolean;
}

export interface ViewContext {
  savedViewsEnabled: boolean;
  activeViewId: string | null;
  activeViewType: string | null;
  availableViews: AvailableView[];
  viewWhere: Record<string, unknown>;
  viewOrderBy: Array<Record<string, "asc" | "desc">>;
}

const EMPTY_VIEW_CONTEXT: ViewContext = {
  savedViewsEnabled: false,
  activeViewId: null,
  activeViewType: null,
  availableViews: [],
  viewWhere: {},
  viewOrderBy: [],
};

export async function resolveViewContext(
  request: Request,
  tenantId: string,
  userId: string,
  entityType: string,
  fieldMap: FieldMap,
): Promise<ViewContext> {
  const savedViewsEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.SAVED_VIEWS, {
    tenantId,
    userId,
  });

  if (!savedViewsEnabled) return EMPTY_VIEW_CONTEXT;

  const { activeView, availableViews } = await resolveActiveView(
    request,
    tenantId,
    userId,
    entityType,
  );

  return {
    savedViewsEnabled: true,
    activeViewId: activeView?.id ?? null,
    activeViewType: activeView?.viewType ?? null,
    availableViews: availableViews.map((v) => ({
      id: v.id,
      name: v.name,
      viewType: v.viewType,
      isDefault: v.isDefault,
      isShared: v.isShared,
    })),
    viewWhere: activeView
      ? buildPrismaWhere(activeView.filters as unknown as SavedViewFilter[], fieldMap)
      : {},
    viewOrderBy: activeView
      ? buildPrismaOrderBy(activeView.sorts as unknown as SavedViewSort[], fieldMap)
      : [],
  };
}
