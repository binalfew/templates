import { redirect } from "react-router";
import { prisma } from "~/lib/db.server";
import { logger } from "~/lib/logger.server";
import { getUserId, logout } from "~/lib/session.server";
import type { Route } from "./+types/logout";

export async function loader() {
  throw redirect("/auth/login");
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await getUserId(request);

  if (userId) {
    logger.info({ userId }, "User logged out");
    await prisma.auditLog.create({
      data: {
        userId,
        action: "LOGOUT",
        entityType: "User",
        entityId: userId,
        description: "User logged out",
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    });
  }

  return logout(request);
}
