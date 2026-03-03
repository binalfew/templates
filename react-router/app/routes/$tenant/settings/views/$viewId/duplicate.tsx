import { redirect } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

import { requireAuth } from "~/lib/auth/require-auth.server";
import { duplicateView } from "~/services/saved-views.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import type { Route } from "./+types/duplicate";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "No tenant", { status: 403 });

  try {
    await duplicateView(params.viewId, user.id, tenantId);
  } catch (error) {
    throw handleServiceError(error);
  }

  const redirectTo = new URL(request.url).searchParams.get("redirectTo");
  return redirect(redirectTo || `/${params.tenant}/settings/views`);
}
