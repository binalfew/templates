import { prisma } from "~/utils/db/db.server";
import { apiAuth, requireApiPermission } from "~/utils/auth/api-auth.server";
import { jsonPaginated, jsonSuccess, jsonError, parsePagination } from "~/utils/api-response.server";
import type { Route } from "./+types/custom-objects.$objectId.records";

export async function loader({ request, params }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "custom_object:read");

  const obj = await prisma.customObjectDefinition.findFirst({
    where: { id: params.objectId, tenantId: auth.tenantId, deletedAt: null },
  });
  if (!obj) return jsonError("NOT_FOUND", "Custom object not found", 404);

  const url = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(url);

  const where = { definitionId: params.objectId, tenantId: auth.tenantId };
  const [records, total] = await Promise.all([
    prisma.customObjectRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: { id: true, data: true, createdBy: true, createdAt: true, updatedAt: true },
    }),
    prisma.customObjectRecord.count({ where }),
  ]);

  return jsonPaginated(records, total, page, pageSize);
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  }

  const auth = await apiAuth(request);
  requireApiPermission(auth, "custom_object:write");

  const obj = await prisma.customObjectDefinition.findFirst({
    where: { id: params.objectId, tenantId: auth.tenantId, deletedAt: null },
  });
  if (!obj) return jsonError("NOT_FOUND", "Custom object not found", 404);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body");
  }

  const record = await prisma.customObjectRecord.create({
    data: {
      definitionId: params.objectId,
      tenantId: auth.tenantId,
      data: body.data || {},
      createdBy: auth.apiKeyId,
    },
    select: { id: true, data: true, createdAt: true },
  });

  return jsonSuccess(record, 201);
}
