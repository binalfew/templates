import { data, redirect } from "react-router";
import { requireGlobalAdmin } from "~/utils/auth/require-auth.server";
import {
  startImpersonating,
  stopImpersonating,
  getImpersonationState,
} from "~/utils/auth/session.server";
import { prisma } from "~/utils/db/db.server";

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  if (_action === "start") {
    const { user } = await requireGlobalAdmin(request);
    const targetUserId = formData.get("targetUserId") as string;
    if (!targetUserId) return data({ error: "Target user required" }, { status: 400 });
    if (targetUserId === user.id) {
      return data({ error: "Cannot impersonate yourself" }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        tenant: { select: { slug: true } },
      },
    });
    if (!target) return data({ error: "User not found" }, { status: 404 });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        action: "IMPERSONATE_START",
        entityType: "User",
        entityId: targetUserId,
        description: `Started impersonating ${target.name || target.email}`,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent"),
        metadata: { targetUserId, targetEmail: target.email },
      },
    });

    const redirectTo = target.tenant?.slug ? `/${target.tenant.slug}` : "/admin";
    return startImpersonating(request, targetUserId, redirectTo);
  }

  if (_action === "stop") {
    const state = await getImpersonationState(request);
    if (!state.isImpersonating || !state.originalUserId) {
      return redirect("/admin");
    }

    const admin = await prisma.user.findFirst({
      where: { id: state.originalUserId },
      select: {
        id: true,
        tenantId: true,
        tenant: { select: { slug: true } },
      },
    });

    if (admin) {
      await prisma.auditLog.create({
        data: {
          userId: admin.id,
          tenantId: admin.tenantId,
          action: "IMPERSONATE_END",
          entityType: "User",
          entityId: state.impersonatedUserId,
          description: "Stopped impersonating user",
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
          userAgent: request.headers.get("user-agent"),
        },
      });
    }

    const redirectTo = admin?.tenant?.slug ? `/${admin.tenant.slug}` : "/admin";
    return stopImpersonating(request, redirectTo);
  }

  return data({ error: "Unknown action" }, { status: 400 });
}
