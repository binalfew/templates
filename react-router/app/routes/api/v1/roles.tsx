import { z } from "zod/v4";
import { prisma } from "~/utils/db/db.server";
import { apiAuth, requireApiPermission } from "~/utils/auth/api-auth.server";
import { jsonPaginated, jsonSuccess, jsonError, parsePagination } from "~/utils/api-response.server";
import { parseApiRequest } from "~/utils/api/middleware.server";
import { checkIdempotencyKey, storeIdempotencyKey } from "~/utils/api/idempotency.server";
import type { Route } from "./+types/roles";

const createRoleBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  scope: z.enum(["GLOBAL", "TENANT", "EVENT"]).optional().default("TENANT"),
});

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "role:read");

  const url = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(url);

  // Soft-delete extension auto-filters deletedAt: null on findMany/count
  const where = { tenantId: auth.tenantId };
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
  const { auth, body } = await parseApiRequest(request, {
    permission: "role:write",
    methods: ["POST"],
    bodySchema: createRoleBody,
  });

  // Idempotency: return cached response for duplicate requests
  const cached = await checkIdempotencyKey(request, auth.tenantId);
  if (cached) return cached;

  const role = await prisma.role.create({
    data: {
      tenantId: auth.tenantId,
      name: body.name,
      description: body.description,
      scope: body.scope,
    },
    select: { id: true, name: true, description: true, scope: true, createdAt: true },
  });

  const response = jsonSuccess(role, 201);
  await storeIdempotencyKey(request, auth.tenantId, response);
  return response;
}
