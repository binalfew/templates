import { z } from "zod/v4";
import { prisma } from "~/utils/db/db.server";
import { apiAuth, requireApiPermission } from "~/utils/auth/api-auth.server";
import { jsonSuccess, jsonError } from "~/utils/api-response.server";
import { parseApiRequest } from "~/utils/api/middleware.server";
import type { Route } from "./+types/users.$userId";

const updateUserBody = z.object({
  name: z.string().optional(),
  username: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]).optional(),
});

export async function loader({ request, params }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "user:read");

  // Soft-delete extension auto-filters deletedAt: null on findFirst
  const user = await prisma.user.findFirst({
    where: { id: params.userId, tenantId: auth.tenantId },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      status: true,
      twoFactorEnabled: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        select: { role: { select: { id: true, name: true, scope: true } } },
      },
    },
  });

  if (!user) return jsonError("NOT_FOUND", "User not found", 404);
  return jsonSuccess(user);
}

export async function action({ request, params }: Route.ActionArgs) {
  const auth = await apiAuth(request);

  if (request.method === "PUT") {
    const { body } = await parseApiRequest(request, {
      permission: "user:write",
      bodySchema: updateUserBody,
    });

    const user = await prisma.user.findFirst({
      where: { id: params.userId, tenantId: auth.tenantId },
    });
    if (!user) return jsonError("NOT_FOUND", "User not found", 404);

    const updated = await prisma.user.update({
      where: { id: params.userId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.username !== undefined && { username: body.username }),
        ...(body.status !== undefined && { status: body.status }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });

    return jsonSuccess(updated);
  }

  if (request.method === "DELETE") {
    requireApiPermission(auth, "user:delete");

    const user = await prisma.user.findFirst({
      where: { id: params.userId, tenantId: auth.tenantId },
    });
    if (!user) return jsonError("NOT_FOUND", "User not found", 404);

    // Soft delete — set deletedAt manually (extension doesn't intercept update)
    await prisma.user.update({
      where: { id: params.userId },
      data: { deletedAt: new Date() },
    });

    return jsonSuccess({ deleted: true });
  }

  return jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
}
