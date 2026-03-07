import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Bell,
  Database,
} from "lucide-react";
import { ADMIN_ONLY, ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";

export type NavChild = {
  title: string;
  tKey?: string;
  url: string;
  end?: boolean;
  roles?: string[];
  featureFlag?: string;
};

export type NavItem = {
  title: string;
  tKey?: string;
  url: string;
  icon: LucideIcon;
  end?: boolean;
  roles?: string[];
  featureFlag?: string;
  children?: NavChild[];
};

export type NavGroup = {
  label: string;
  tKey?: string;
  items: NavItem[];
};

function isVisibleEntry(
  entry: { roles?: string[]; featureFlag?: string },
  userRoles: string[],
  enabledFeatures?: Record<string, boolean>,
): boolean {
  return (
    (!entry.roles || entry.roles.some((r) => userRoles.includes(r))) &&
    (!entry.featureFlag || !!enabledFeatures?.[entry.featureFlag])
  );
}

export function buildNavigationGroups(basePrefix: string): NavGroup[] {
  return [
    {
      label: "Main",
      tKey: "main",
      items: [
        {
          title: "Dashboard",
          tKey: "dashboard",
          url: basePrefix,
          icon: LayoutDashboard,
          end: true,
        },
        {
          title: "Notifications",
          tKey: "notifications",
          url: `${basePrefix}/notifications`,
          icon: Bell,
        },
      ],
    },
    {
      label: "Administration",
      tKey: "administration",
      items: [
        {
          title: "Tenants",
          tKey: "tenants",
          url: `${basePrefix}/tenants`,
          icon: Building2,
          roles: [...ADMIN_ONLY],
        },
        {
          title: "Data",
          tKey: "data",
          url: `${basePrefix}/data`,
          icon: Database,
          roles: [...ADMIN_ONLY],
        },
        {
          title: "Logs",
          tKey: "auditLogs",
          url: `${basePrefix}/logs`,
          icon: ClipboardList,
          roles: [...ADMIN_ONLY],
        },
      ],
    },
  ];
}

export function buildSettingsChildren(basePrefix: string): NavChild[] {
  return [
    {
      title: "General",
      tKey: "general",
      url: `${basePrefix}/settings`,
      end: true,
      roles: [...ADMIN_OR_TENANT_ADMIN],
    },
    {
      title: "Organization",
      tKey: "organization",
      url: `${basePrefix}/settings/organization`,
      roles: [...ADMIN_OR_TENANT_ADMIN],
    },
    {
      title: "Features",
      tKey: "featureFlags",
      url: `${basePrefix}/settings/features`,
      roles: [...ADMIN_ONLY],
    },
    {
      title: "APIs",
      tKey: "apis",
      url: `${basePrefix}/settings/apis`,
      roles: [...ADMIN_OR_TENANT_ADMIN],
      featureFlag: "FF_REST_API",
    },
    {
      title: "Webhooks",
      tKey: "webhooks",
      url: `${basePrefix}/settings/webhooks`,
      roles: [...ADMIN_OR_TENANT_ADMIN],
      featureFlag: "FF_WEBHOOKS",
    },
    {
      title: "2FA",
      tKey: "twoFactor",
      url: `${basePrefix}/settings/twofactor`,
      roles: [...ADMIN_OR_TENANT_ADMIN],
      featureFlag: "FF_TWO_FACTOR",
    },
    {
      title: "Health",
      tKey: "health",
      url: `${basePrefix}/settings/health`,
      roles: [...ADMIN_ONLY],
    },
    {
      title: "Views",
      tKey: "savedViews",
      url: `${basePrefix}/settings/views`,
      roles: [...ADMIN_OR_TENANT_ADMIN],
      featureFlag: "FF_SAVED_VIEWS",
    },
    {
      title: "Announcements",
      tKey: "announcements",
      url: `${basePrefix}/settings/announcements`,
      roles: [...ADMIN_OR_TENANT_ADMIN],
    },
  ];
}

export function getVisibleSettingsChildren(
  roles: string[],
  basePrefix = "/admin",
  enabledFeatures?: Record<string, boolean>,
): NavChild[] {
  return buildSettingsChildren(basePrefix).filter((child) =>
    isVisibleEntry(child, roles, enabledFeatures),
  );
}

export function buildSecurityChildren(basePrefix: string): NavChild[] {
  return [
    {
      title: "Users",
      tKey: "users",
      url: `${basePrefix}/security/users`,
      roles: [...ADMIN_OR_TENANT_ADMIN],
    },
    {
      title: "Roles",
      tKey: "roles",
      url: `${basePrefix}/security/roles`,
      roles: [...ADMIN_OR_TENANT_ADMIN],
    },
    {
      title: "Permissions",
      tKey: "permissions",
      url: `${basePrefix}/security/permissions`,
      roles: [...ADMIN_OR_TENANT_ADMIN],
    },
  ];
}

export function getVisibleSecurityChildren(
  roles: string[],
  basePrefix = "/admin",
  enabledFeatures?: Record<string, boolean>,
): NavChild[] {
  return buildSecurityChildren(basePrefix).filter((child) =>
    isVisibleEntry(child, roles, enabledFeatures),
  );
}

export function buildDataChildren(basePrefix: string): NavChild[] {
  return [
    {
      title: "Import",
      tKey: "import",
      url: `${basePrefix}/data/import`,
      end: true,
      roles: [...ADMIN_ONLY],
    },
    {
      title: "Export",
      tKey: "export",
      url: `${basePrefix}/data/export`,
      roles: [...ADMIN_ONLY],
    },
    {
      title: "References",
      tKey: "referenceData",
      url: `${basePrefix}/data/references`,
      roles: [...ADMIN_ONLY],
    },
  ];
}

export function getVisibleDataChildren(
  roles: string[],
  basePrefix = "/admin",
  enabledFeatures?: Record<string, boolean>,
): NavChild[] {
  return buildDataChildren(basePrefix).filter((child) =>
    isVisibleEntry(child, roles, enabledFeatures),
  );
}

export function getVisibleGroups(
  roles: string[],
  basePrefix = "/admin",
  enabledFeatures?: Record<string, boolean>,
): NavGroup[] {
  return buildNavigationGroups(basePrefix)
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => isVisibleEntry(item, roles, enabledFeatures))
        .map((item) => ({
          ...item,
          children: item.children?.filter((child) =>
            isVisibleEntry(child, roles, enabledFeatures),
          ),
        })),
    }))
    .filter((group) => group.items.length > 0);
}
