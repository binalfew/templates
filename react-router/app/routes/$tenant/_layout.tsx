import { data, useLoaderData } from "react-router";
import { RouteErrorBoundary } from "~/components/route-error-boundary";
import { requireAuth, toClientUser } from "~/utils/auth/require-auth.server";
import { resolveTenant } from "~/utils/tenant.server";
import { getSidebarState, getSidebarGroupState } from "~/utils/sidebar.server";
import { getTheme } from "~/utils/theme.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { env } from "~/utils/config/env.server";
import { DashboardLayout } from "~/components/layout/dashboard-layout";
import type { Route } from "./+types/_layout";

export async function loader({ request, params }: Route.LoaderArgs) {
  const tenant = await resolveTenant(params.tenant);
  const { user, roles } = await requireAuth(request);

  if (user.tenantId !== tenant.id) {
    throw data({ error: "You do not have access to this tenant" }, { status: 403 });
  }

  const flagContext = {
    tenantId: tenant.id,
    roles,
    userId: user.id,
  };

  const sseEnabled = env.ENABLE_SSE && (await isFeatureEnabled("FF_SSE_UPDATES", flagContext));
  const notificationsEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.NOTIFICATIONS, flagContext);
  const shortcutsEnabled = await isFeatureEnabled(
    FEATURE_FLAG_KEYS.KEYBOARD_SHORTCUTS,
    flagContext,
  );
  const i18nEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.I18N, flagContext);
  const pwaEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.PWA, flagContext);
  const offlineEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.OFFLINE_MODE, flagContext);
  const restApiEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.REST_API, flagContext);
  const webhooksEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.WEBHOOKS, flagContext);
  const savedViewsEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.SAVED_VIEWS, flagContext);
  const globalSearchEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.GLOBAL_SEARCH, flagContext);
  const twoFactorEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.TWO_FACTOR, flagContext);
  const invitationsEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.INVITATIONS, flagContext);

  const enabledFeatures: Record<string, boolean> = {
    FF_NOTIFICATIONS: notificationsEnabled,
    FF_REST_API: restApiEnabled,
    FF_WEBHOOKS: webhooksEnabled,
    FF_SAVED_VIEWS: savedViewsEnabled,
    FF_GLOBAL_SEARCH: globalSearchEnabled,
    FF_TWO_FACTOR: twoFactorEnabled,
    FF_INVITATIONS: invitationsEnabled,
  };

  return {
    user: { id: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl },
    clientUser: toClientUser(user),
    roles,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.subscriptionPlan,
      logoUrl: tenant.logoUrl,
      brandTheme: tenant.brandTheme,
    },
    sidebarOpen: getSidebarState(request),
    sidebarGroups: getSidebarGroupState(request),
    theme: getTheme(request),
    sseEnabled,
    notificationsEnabled,
    searchEnabled: globalSearchEnabled,
    shortcutsEnabled,
    i18nEnabled,
    pwaEnabled,
    offlineEnabled,
    unreadCount: 0,
    recentNotifications: [] as Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      read: boolean;
      createdAt: string;
    }>,
    enabledFeatures,
    inactivityTimeoutMinutes: 60,
  };
}

export function ErrorBoundary() {
  return <RouteErrorBoundary context="tenant layout" />;
}

export default function TenantLayout() {
  const loaderData = useLoaderData<typeof loader>();
  const { tenant } = loaderData;

  return (
    <DashboardLayout
      basePrefix={`/${tenant.slug}`}
      tenant={{
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        logoUrl: tenant.logoUrl,
      }}
      user={loaderData.user}
      roles={loaderData.roles}
      sidebarOpen={loaderData.sidebarOpen}
      sidebarGroups={loaderData.sidebarGroups}
      theme={loaderData.theme}
      sseEnabled={loaderData.sseEnabled}
      notificationsEnabled={loaderData.notificationsEnabled}
      searchEnabled={loaderData.searchEnabled}
      shortcutsEnabled={loaderData.shortcutsEnabled}
      i18nEnabled={loaderData.i18nEnabled}
      pwaEnabled={loaderData.pwaEnabled}
      offlineEnabled={loaderData.offlineEnabled}
      unreadCount={loaderData.unreadCount}
      recentNotifications={loaderData.recentNotifications}
      enabledFeatures={loaderData.enabledFeatures}
      inactivityTimeoutMinutes={loaderData.inactivityTimeoutMinutes}
    />
  );
}
