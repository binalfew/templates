import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  Shield,
  Settings,
  BarChart3,
  ClipboardList,
  Bell,
  Search,
  Upload,
  Download,
} from "lucide-react";

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
          featureFlag: "FF_NOTIFICATIONS",
        },
        {
          title: "Search",
          tKey: "search",
          url: `${basePrefix}/search`,
          icon: Search,
          featureFlag: "FF_GLOBAL_SEARCH",
        },
      ],
    },
    {
      label: "Management",
      tKey: "management",
      items: [
        {
          title: "Tenants",
          tKey: "tenants",
          url: `${basePrefix}/tenants`,
          icon: Building2,
          roles: ["ADMIN"],
        },
      ],
    },
    {
      label: "Content",
      tKey: "content",
      items: [
        {
          title: "File Uploads",
          tKey: "fileUploads",
          url: `${basePrefix}/uploads`,
          icon: Upload,
          featureFlag: "FF_FILE_UPLOADS",
        },
        {
          title: "Import",
          tKey: "import",
          url: `${basePrefix}/import`,
          icon: Upload,
          featureFlag: "FF_DATA_IMPORT_EXPORT",
        },
        {
          title: "Export",
          tKey: "export",
          url: `${basePrefix}/export`,
          icon: Download,
          featureFlag: "FF_DATA_IMPORT_EXPORT",
        },
      ],
    },
    {
      label: "Insights",
      tKey: "insights",
      items: [
        {
          title: "Analytics",
          tKey: "analytics",
          url: `${basePrefix}/analytics`,
          icon: BarChart3,
          roles: ["ADMIN", "TENANT_ADMIN"],
          featureFlag: "FF_ANALYTICS",
        },
      ],
    },
    {
      label: "Administration",
      tKey: "administration",
      items: [
        {
          title: "Settings",
          tKey: "settings",
          url: `${basePrefix}/settings`,
          icon: Settings,
          roles: ["ADMIN", "TENANT_ADMIN"],
        },
        {
          title: "Security",
          tKey: "security",
          url: `${basePrefix}/security`,
          icon: Shield,
          roles: ["ADMIN", "TENANT_ADMIN"],
        },
        {
          title: "Logs",
          tKey: "auditLogs",
          url: `${basePrefix}/logs`,
          icon: ClipboardList,
          roles: ["ADMIN"],
        },
      ],
    },
  ];
}

export function buildSettingsChildren(basePrefix: string): NavChild[] {
  return [
    { title: "General", tKey: "general", url: `${basePrefix}/settings`, end: true },
    {
      title: "Organization",
      tKey: "organization",
      url: `${basePrefix}/settings/organization`,
      roles: ["ADMIN", "TENANT_ADMIN"],
    },
    {
      title: "Features",
      tKey: "featureFlags",
      url: `${basePrefix}/settings/features`,
      roles: ["ADMIN"],
    },
    {
      title: "API Keys",
      tKey: "apiKeys",
      url: `${basePrefix}/settings/api-keys`,
      roles: ["ADMIN", "TENANT_ADMIN"],
      featureFlag: "FF_REST_API",
    },
    {
      title: "Webhooks",
      tKey: "webhooks",
      url: `${basePrefix}/settings/webhooks`,
      roles: ["ADMIN", "TENANT_ADMIN"],
      featureFlag: "FF_WEBHOOKS",
    },
    {
      title: "Fields",
      tKey: "customFields",
      url: `${basePrefix}/settings/fields`,
      roles: ["ADMIN", "TENANT_ADMIN"],
      featureFlag: "FF_CUSTOM_FIELDS",
    },
    {
      title: "References",
      tKey: "referenceData",
      url: `${basePrefix}/settings/references`,
      roles: ["ADMIN"],
    },
    {
      title: "Security",
      tKey: "security",
      url: `${basePrefix}/settings/security`,
      roles: ["ADMIN", "TENANT_ADMIN"],
      featureFlag: "FF_TWO_FACTOR",
    },
    {
      title: "Views",
      tKey: "savedViews",
      url: `${basePrefix}/settings/views`,
      featureFlag: "FF_SAVED_VIEWS",
    },
    {
      title: "Objects",
      tKey: "customObjects",
      url: `${basePrefix}/settings/objects`,
      featureFlag: "FF_CUSTOM_OBJECTS",
    },
    {
      title: "Templates",
      tKey: "messageTemplates",
      url: `${basePrefix}/settings/templates`,
      featureFlag: "FF_BROADCASTS",
    },
    {
      title: "Broadcasts",
      tKey: "broadcasts",
      url: `${basePrefix}/settings/broadcasts`,
      featureFlag: "FF_BROADCASTS",
    },
    {
      title: "Forms",
      tKey: "formDesigner",
      url: `${basePrefix}/settings/forms`,
      featureFlag: "FF_FORM_DESIGNER",
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
      end: true,
      roles: ["ADMIN", "TENANT_ADMIN"],
    },
    {
      title: "Roles",
      tKey: "roles",
      url: `${basePrefix}/security/roles`,
      roles: ["ADMIN"],
    },
    {
      title: "Permissions",
      tKey: "permissions",
      url: `${basePrefix}/security/permissions`,
      roles: ["ADMIN"],
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
