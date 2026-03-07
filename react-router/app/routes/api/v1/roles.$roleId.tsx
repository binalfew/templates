import { z } from "zod/v4";
import { prisma } from "~/utils/db/db.server";
import { apiAuth, requireApiPermission } from "~/utils/auth/api-auth.server";
import { jsonSuccess, jsonError } from "~/utils/api-response.server";
import { parseApiRequest } from "~/utils/api/middleware.server";
import type { Route } from "./+types/roles.$roleId";

const updateRoleBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function loader({ request, params }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "role:read");

  // Soft-delete extension auto-filters deletedAt: null on findFirst
  const role = await prisma.role.findFirst({
    where: { id: params.roleId, tenantId: auth.tenantId },
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
    const { body } = await parseApiRequest(request, {
      permission: "role:write",
      bodySchema: updateRoleBody,
    });

    const role = await prisma.role.findFirst({
      where: { id: params.roleId, tenantId: auth.tenantId },
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
      where: { id: params.roleId, tenantId: auth.tenantId },
    });
    if (!role) return jsonError("NOT_FOUND", "Role not found", 404);

    // Soft delete — set deletedAt manually (extension doesn't intercept update)
    await prisma.role.update({
      where: { id: params.roleId },
      data: { deletedAt: new Date() },
    });

    return jsonSuccess({ deleted: true });
  }

  return jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
}
