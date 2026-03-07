import { z } from "zod/v4";
import { prisma } from "~/utils/db/db.server";
import { apiAuth, requireApiPermission } from "~/utils/auth/api-auth.server";
import { jsonPaginated, jsonSuccess, jsonError, parsePagination } from "~/utils/api-response.server";
import { parseApiRequest } from "~/utils/api/middleware.server";
import { checkIdempotencyKey, storeIdempotencyKey } from "~/utils/api/idempotency.server";
import { hashPassword } from "~/utils/auth/auth.server";
import type { Route } from "./+types/users";

const createUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  username: z.string().optional(),
});

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "user:read");

  const url = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(url);

  // Soft-delete extension auto-filters deletedAt: null on findMany/count
  const where = { tenantId: auth.tenantId };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return jsonPaginated(users, total, page, pageSize);
}

export async function action({ request }: Route.ActionArgs) {
  const { auth, body } = await parseApiRequest(request, {
    permission: "user:write",
    methods: ["POST"],
    bodySchema: createUserBody,
  });

  // Idempotency: return cached response for duplicate requests
  const cached = await checkIdempotencyKey(request, auth.tenantId);
  if (cached) return cached;

  const existing = await prisma.user.findFirst({ where: { email: body.email } });
  if (existing) {
    return jsonError("CONFLICT", "A user with this email already exists", 409);
  }

  const passwordHash = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      username: body.username,
      tenantId: auth.tenantId,
      password: { create: { hash: passwordHash } },
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      status: true,
      createdAt: true,
    },
  });

  const response = jsonSuccess(user, 201);
  await storeIdempotencyKey(request, auth.tenantId, response);
  return response;
}
