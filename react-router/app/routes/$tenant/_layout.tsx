import { data, useLoaderData } from "react-router";
import { RouteErrorBoundary } from "~/components/route-error-boundary";
import { requireAuth, toClientUser } from "~/utils/auth/require-auth.server";
import { getImpersonationState } from "~/utils/auth/session.server";
import { resolveTenant } from "~/utils/tenant.server";
import { getSidebarState, getSidebarGroupState } from "~/utils/sidebar.server";
import { getTheme, brandCookie } from "~/utils/theme.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getUnreadCount, listNotifications } from "~/services/notifications.server";
import { getActiveAnnouncements } from "~/services/announcements.server";
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

  const i18nEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.I18N, flagContext);
  const pwaEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.PWA, flagContext);
  const restApiEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.REST_API, flagContext);
  const webhooksEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.WEBHOOKS, flagContext);
  const savedViewsEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.SAVED_VIEWS, flagContext);
  const twoFactorEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.TWO_FACTOR, flagContext);
  const enabledFeatures: Record<string, boolean> = {
    FF_REST_API: restApiEnabled,
    FF_WEBHOOKS: webhooksEnabled,
    FF_SAVED_VIEWS: savedViewsEnabled,
    FF_TWO_FACTOR: twoFactorEnabled,
  };

  const impersonationState = await getImpersonationState(request);
  const impersonation = impersonationState.isImpersonating
    ? { isImpersonating: true as const, impersonatedUserName: user.name || user.email }
    : undefined;

  const headers = new Headers();
  headers.set("Set-Cookie", await brandCookie.serialize(tenant.slug));

  return data(
    {
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
    i18nEnabled,
    pwaEnabled,
    unreadCount: await getUnreadCount(user.id),
    recentNotifications: (await listNotifications(user.id, { perPage: 5 })).notifications.map(
      (n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }),
    ),
    announcements: (await getActiveAnnouncements(tenant.id, user.id)).map((a) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      type: a.type,
      dismissible: a.dismissible,
    })),
    enabledFeatures,
    inactivityTimeoutMinutes: 60,
    impersonation,
    },
    { headers },
  );
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
      i18nEnabled={loaderData.i18nEnabled}
      pwaEnabled={loaderData.pwaEnabled}
      unreadCount={loaderData.unreadCount}
      recentNotifications={loaderData.recentNotifications}
      announcements={loaderData.announcements}
      enabledFeatures={loaderData.enabledFeatures}
      inactivityTimeoutMinutes={loaderData.inactivityTimeoutMinutes}
      impersonation={loaderData.impersonation}
    />
  );
}
