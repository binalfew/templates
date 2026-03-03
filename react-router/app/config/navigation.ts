import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  KeyRound,
  Settings,
  BarChart3,
  ClipboardList,
  Bell,
  Database,
  Webhook,
  Key,
  Search,
  Bookmark,
  Boxes,
  MessageSquare,
  Send,
  Upload,
  FormInput,
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
        {
          title: "Users",
          tKey: "users",
          url: `${basePrefix}/users`,
          icon: Users,
          roles: ["ADMIN", "TENANT_ADMIN"],
        },
        {
          title: "Roles",
          tKey: "roles",
          url: `${basePrefix}/roles`,
          icon: Shield,
          roles: ["ADMIN"],
        },
        {
          title: "Permissions",
          tKey: "permissions",
          url: `${basePrefix}/permissions`,
          icon: KeyRound,
          roles: ["ADMIN"],
        },
      ],
    },
    {
      label: "Content",
      tKey: "content",
      items: [
        {
          title: "Views",
          tKey: "savedViews",
          url: `${basePrefix}/views`,
          icon: Bookmark,
          featureFlag: "FF_SAVED_VIEWS",
        },
        {
          title: "Objects",
          tKey: "customObjects",
          url: `${basePrefix}/objects`,
          icon: Boxes,
          featureFlag: "FF_CUSTOM_OBJECTS",
        },
        {
          title: "Templates",
          tKey: "messageTemplates",
          url: `${basePrefix}/templates`,
          icon: MessageSquare,
          featureFlag: "FF_BROADCASTS",
        },
        {
          title: "Broadcasts",
          tKey: "broadcasts",
          url: `${basePrefix}/broadcasts`,
          icon: Send,
          featureFlag: "FF_BROADCASTS",
        },
        {
          title: "File Uploads",
          tKey: "fileUploads",
          url: `${basePrefix}/uploads`,
          icon: Upload,
          featureFlag: "FF_FILE_UPLOADS",
        },
        {
          title: "Forms",
          tKey: "formDesigner",
          url: `${basePrefix}/forms`,
          icon: FormInput,
          featureFlag: "FF_FORM_DESIGNER",
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
          title: "Logs",
          tKey: "auditLogs",
          url: `${basePrefix}/logs`,
          icon: ClipboardList,
          roles: ["ADMIN"],
        },
        {
          title: "Settings",
          tKey: "settings",
          url: `${basePrefix}/settings`,
          icon: Settings,
          roles: ["ADMIN", "TENANT_ADMIN"],
          children: [
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
          ],
        },
      ],
    },
  ];
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
        .filter((item) => !item.roles || item.roles.some((r) => roles.includes(r)))
        .filter((item) => !item.featureFlag || enabledFeatures?.[item.featureFlag])
        .map((item) => ({
          ...item,
          children: item.children?.filter(
            (child) =>
              (!child.roles || child.roles.some((r) => roles.includes(r))) &&
              (!child.featureFlag || enabledFeatures?.[child.featureFlag]),
          ),
        })),
    }))
    .filter((group) => group.items.length > 0);
}
