import { prisma } from "~/utils/db/db.server";
import { apiAuth, requireApiPermission } from "~/utils/auth/api-auth.server";
import { jsonSuccess, jsonError } from "~/utils/api-response.server";
import type { Route } from "./+types/users.$userId";

export async function loader({ request, params }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "user:read");

  const user = await prisma.user.findFirst({
    where: { id: params.userId, tenantId: auth.tenantId, deletedAt: null },
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
    requireApiPermission(auth, "user:write");

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonError("BAD_REQUEST", "Invalid JSON body");
    }

    const user = await prisma.user.findFirst({
      where: { id: params.userId, tenantId: auth.tenantId, deletedAt: null },
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
      where: { id: params.userId, tenantId: auth.tenantId, deletedAt: null },
    });
    if (!user) return jsonError("NOT_FOUND", "User not found", 404);

    await prisma.user.update({
      where: { id: params.userId },
      data: { deletedAt: new Date() },
    });

    return jsonSuccess({ deleted: true });
  }

  return jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
}
