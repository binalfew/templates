import { prisma } from "~/lib/db/db.server";
import { apiAuth, requireApiPermission } from "~/lib/auth/api-auth.server";
import { jsonSuccess, jsonError } from "~/lib/api-response.server";
import type { Route } from "./+types/roles.$roleId";

export async function loader({ request, params }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "role:read");

  const role = await prisma.role.findFirst({
    where: { id: params.roleId, tenantId: auth.tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      scope: true,
      createdAt: true,
      updatedAt: true,
      rolePermissions: {
        select: {
          access: true,
          permission: { select: { id: true, resource: true, action: true } },
        },
      },
    },
  });

  if (!role) return jsonError("NOT_FOUND", "Role not found", 404);
  return jsonSuccess(role);
}

export async function action({ request, params }: Route.ActionArgs) {
  const auth = await apiAuth(request);

  if (request.method === "PUT") {
    requireApiPermission(auth, "role:write");

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonError("BAD_REQUEST", "Invalid JSON body");
    }

    const role = await prisma.role.findFirst({
      where: { id: params.roleId, tenantId: auth.tenantId, deletedAt: null },
    });
    if (!role) return jsonError("NOT_FOUND", "Role not found", 404);

    const updated = await prisma.role.update({
      where: { id: params.roleId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
      },
      select: { id: true, name: true, description: true, scope: true, updatedAt: true },
    });

    return jsonSuccess(updated);
  }

  if (request.method === "DELETE") {
    requireApiPermission(auth, "role:delete");

    const role = await prisma.role.findFirst({
      where: { id: params.roleId, tenantId: auth.tenantId, deletedAt: null },
    });
    if (!role) return jsonError("NOT_FOUND", "Role not found", 404);

    await prisma.role.update({
      where: { id: params.roleId },
      data: { deletedAt: new Date() },
    });

    return jsonSuccess({ deleted: true });
  }

  return jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
}
