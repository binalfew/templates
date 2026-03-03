import { prisma } from "~/lib/db.server";
import { apiAuth, requireApiPermission } from "~/lib/api-auth.server";
import { jsonPaginated, jsonSuccess, jsonError, parsePagination } from "~/lib/api-response.server";
import type { Route } from "./+types/roles";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "role:read");

  const url = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(url);

  const where = { tenantId: auth.tenantId, deletedAt: null };
  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        scope: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.role.count({ where }),
  ]);

  return jsonPaginated(roles, total, page, pageSize);
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  }

  const auth = await apiAuth(request);
  requireApiPermission(auth, "role:write");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body");
  }

  const { name, description, scope } = body;
  if (!name) return jsonError("VALIDATION_ERROR", "name is required");

  const role = await prisma.role.create({
    data: {
      tenantId: auth.tenantId,
      name,
      description,
      scope: scope || "TENANT",
    },
    select: { id: true, name: true, description: true, scope: true, createdAt: true },
  });

  return jsonSuccess(role, 201);
}
