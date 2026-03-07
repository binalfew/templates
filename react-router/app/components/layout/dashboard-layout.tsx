import { Outlet, useNavigation } from "react-router";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/layout/app-sidebar";
import { TopNavbar } from "~/components/layout/top-navbar";
import { Toaster } from "~/components/ui/toaster";
import {
  getVisibleSettingsChildren,
  getVisibleSecurityChildren,
  getVisibleDataChildren,
} from "~/config/navigation";
import { InstallPrompt } from "~/components/pwa/install-prompt";
import { SwUpdatePrompt } from "~/components/pwa/sw-update-prompt";
import { LogoutTimer } from "~/components/logout-timer";
import type { Theme } from "~/utils/theme.server";

type TenantInfo = {
  name: string;
  slug: string;
  plan: string;
  logoUrl?: string | null;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type DashboardLayoutProps = {
  basePrefix: string;
  tenant?: TenantInfo | null;
  user: { id: string; name: string | null; email: string; photoUrl?: string | null };
  roles: string[];
  sidebarOpen: boolean;
  sidebarGroups: Record<string, boolean>;
  theme?: Theme | null;
  sseEnabled: boolean;
  notificationsEnabled: boolean;
  searchEnabled: boolean;
  shortcutsEnabled: boolean;
  i18nEnabled: boolean;
  pwaEnabled: boolean;
  offlineEnabled: boolean;
  unreadCount: number;
  recentNotifications: NotificationItem[];
  enabledFeatures?: Record<string, boolean>;
  inactivityTimeoutMinutes?: number;
};

export function DashboardLayout({
  basePrefix,
  tenant,
  user,
  roles,
  sidebarOpen,
  sidebarGroups,
  theme,
  notificationsEnabled,
  searchEnabled,
  shortcutsEnabled,
  i18nEnabled,
  pwaEnabled,
  offlineEnabled,
  unreadCount,
  recentNotifications,
  enabledFeatures,
  inactivityTimeoutMinutes,
}: DashboardLayoutProps) {
  const navigation = useNavigation();
  const isNavigating = navigation.state === "loading";
  const settingsChildren = getVisibleSettingsChildren(roles, basePrefix, enabledFeatures);
  const securityChildren = getVisibleSecurityChildren(roles, basePrefix, enabledFeatures);
  const dataChildren = getVisibleDataChildren(roles, basePrefix, enabledFeatures);

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        roles={roles}
        groupState={sidebarGroups}
        basePrefix={basePrefix}
        tenant={tenant}
        enabledFeatures={enabledFeatures}
      />
      <SidebarInset>
        {isNavigating && (
          <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/20">
            <div className="h-full w-1/3 animate-[progress_1s_ease-in-out_infinite] bg-primary" />
          </div>
        )}
        <TopNavbar
          user={user}
          basePrefix={basePrefix}
          theme={theme}
          notificationsEnabled={notificationsEnabled}
          searchEnabled={searchEnabled}
          shortcutsEnabled={shortcutsEnabled}
          i18nEnabled={i18nEnabled}
          offlineEnabled={offlineEnabled}
          unreadCount={unreadCount}
          notifications={recentNotifications}
          settingsChildren={settingsChildren}
          securityChildren={securityChildren}
          dataChildren={dataChildren}
        />
        <div className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
      <Toaster />
      {pwaEnabled && (
        <>
          <InstallPrompt />
          <SwUpdatePrompt />
        </>
      )}
      {inactivityTimeoutMinutes != null && inactivityTimeoutMinutes > 0 && (
        <LogoutTimer inactivityTimeoutMinutes={inactivityTimeoutMinutes} />
      )}
    </SidebarProvider>
  );
}
