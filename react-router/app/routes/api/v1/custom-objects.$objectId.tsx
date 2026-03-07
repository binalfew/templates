import { prisma } from "~/utils/db/db.server";
import { apiAuth, requireApiPermission } from "~/utils/auth/api-auth.server";
import { jsonSuccess, jsonError } from "~/utils/api-response.server";
import type { Route } from "./+types/custom-objects.$objectId";

export async function loader({ request, params }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "custom_object:read");

  const obj = await prisma.customObjectDefinition.findFirst({
    where: { id: params.objectId, tenantId: auth.tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      fields: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!obj) return jsonError("NOT_FOUND", "Custom object not found", 404);
  return jsonSuccess(obj);
}

export async function action({ request, params }: Route.ActionArgs) {
  const auth = await apiAuth(request);

  if (request.method === "PUT") {
    requireApiPermission(auth, "custom_object:write");

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonError("BAD_REQUEST", "Invalid JSON body");
    }

    const obj = await prisma.customObjectDefinition.findFirst({
      where: { id: params.objectId, tenantId: auth.tenantId, deletedAt: null },
    });
    if (!obj) return jsonError("NOT_FOUND", "Custom object not found", 404);

    const updated = await prisma.customObjectDefinition.update({
      where: { id: params.objectId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.icon !== undefined && { icon: body.icon }),
        ...(body.fields !== undefined && { fields: body.fields }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      select: { id: true, name: true, slug: true, description: true, updatedAt: true },
    });

    return jsonSuccess(updated);
  }

  if (request.method === "DELETE") {
    requireApiPermission(auth, "custom_object:delete");

    const obj = await prisma.customObjectDefinition.findFirst({
      where: { id: params.objectId, tenantId: auth.tenantId, deletedAt: null },
    });
    if (!obj) return jsonError("NOT_FOUND", "Custom object not found", 404);

    await prisma.customObjectDefinition.update({
      where: { id: params.objectId },
      data: { deletedAt: new Date() },
    });

    return jsonSuccess({ deleted: true });
  }

  return jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
}
