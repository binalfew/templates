import { ChevronsUpDown, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";

type TenantInfo = {
  name: string;
  slug: string;
  plan: string;
  logoUrl?: string | null;
};

const fallbackTenant: TenantInfo = {
  name: "Accreditation",
  slug: "admin",
  plan: "Platform",
};

export function TenantSwitcher({
  tenant,
  basePrefix = "/admin",
}: {
  tenant?: TenantInfo | null;
  basePrefix?: string;
}) {
  const { isMobile, state } = useSidebar();
  const activeTenant = tenant ?? fallbackTenant;
  const isAdmin = basePrefix === "/admin";
  const collapsed = state === "collapsed";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className={`text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground data-[state=open]:bg-primary-foreground/10 data-[state=open]:text-primary-foreground ${collapsed ? "!p-0 !gap-0 !w-8 mx-auto justify-center" : ""}`}
            >
              <div
                className={`text-primary-foreground flex items-center justify-center rounded-lg overflow-hidden ${collapsed ? "size-5" : "aspect-square size-8"}`}
              >
                {activeTenant.logoUrl ? (
                  <img
                    src={activeTenant.logoUrl}
                    alt={activeTenant.name}
                    className={`${collapsed ? "size-5" : "size-8"} rounded-lg object-contain brightness-0 invert`}
                  />
                ) : (
                  <ShieldCheck className={collapsed ? "size-5" : "size-8"} />
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{activeTenant.name}</span>
                    <span className="truncate text-xs text-primary-foreground/70">
                      {activeTenant.plan}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </>
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {isAdmin ? "Super Admin" : "Tenant"}
            </DropdownMenuLabel>
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-sm border overflow-hidden">
                {activeTenant.logoUrl ? (
                  <img
                    src={activeTenant.logoUrl}
                    alt={activeTenant.name}
                    className="size-6 rounded-sm object-contain"
                  />
                ) : (
                  <ShieldCheck className="size-4 shrink-0" />
                )}
              </div>
              {activeTenant.name}
            </DropdownMenuItem>
            {!isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" asChild>
                  <a href={`/${activeTenant.slug}`}>Go to tenant home</a>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
