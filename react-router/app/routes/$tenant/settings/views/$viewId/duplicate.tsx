import { redirect } from "react-router";

import { requireRoleAndFeature } from "~/lib/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/lib/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { duplicateView } from "~/services/saved-views.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import type { Route } from "./+types/duplicate";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.SAVED_VIEWS);

  try {
    await duplicateView(params.viewId, user.id, tenantId);
  } catch (error) {
    throw handleServiceError(error);
  }

  const redirectTo = new URL(request.url).searchParams.get("redirectTo");
  return redirect(redirectTo || `/${params.tenant}/settings/views`);
}
