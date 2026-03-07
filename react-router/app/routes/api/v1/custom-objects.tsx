import { prisma } from "~/utils/db/db.server";
import { apiAuth, requireApiPermission } from "~/utils/auth/api-auth.server";
import { jsonPaginated, jsonSuccess, jsonError, parsePagination } from "~/utils/api-response.server";
import type { Route } from "./+types/custom-objects";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "custom_object:read");

  const url = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(url);

  const where = { tenantId: auth.tenantId, deletedAt: null, isActive: true };
  const [objects, total] = await Promise.all([
    prisma.customObjectDefinition.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        fields: true,
        createdAt: true,
      },
    }),
    prisma.customObjectDefinition.count({ where }),
  ]);

  return jsonPaginated(objects, total, page, pageSize);
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  }

  const auth = await apiAuth(request);
  requireApiPermission(auth, "custom_object:write");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body");
  }

  const { name, slug, description, icon, fields } = body;
  if (!name || !slug) return jsonError("VALIDATION_ERROR", "name and slug are required");

  const obj = await prisma.customObjectDefinition.create({
    data: {
      tenantId: auth.tenantId,
      name,
      slug,
      description,
      icon,
      fields: fields || [],
    },
    select: { id: true, name: true, slug: true, description: true, createdAt: true },
  });

  return jsonSuccess(obj, 201);
}
