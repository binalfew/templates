import * as React from "react";
import { NavMain } from "~/components/layout/nav-main";
import { TenantSwitcher } from "~/components/layout/tenant-switcher";
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from "~/components/ui/sidebar";
import { getVisibleGroups } from "~/config/navigation";

type TenantInfo = {
  name: string;
  slug: string;
  plan: string;
  logoUrl?: string | null;
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  roles: string[];
  groupState: Record<string, boolean>;
  basePrefix?: string;
  tenant?: TenantInfo | null;
  enabledFeatures?: Record<string, boolean>;
};

export function AppSidebar({
  roles,
  groupState,
  basePrefix = "/admin",
  tenant,
  enabledFeatures,
  ...props
}: AppSidebarProps) {
  const groups = getVisibleGroups(roles, basePrefix, enabledFeatures);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-12 justify-center bg-primary p-0 text-primary-foreground">
        <TenantSwitcher tenant={tenant} basePrefix={basePrefix} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={groups} groupState={groupState} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
