import { prisma } from "~/lib/db/db.server";
import { apiAuth, requireApiPermission } from "~/lib/auth/api-auth.server";
import { jsonPaginated, jsonSuccess, jsonError, parsePagination } from "~/lib/api-response.server";
import { hashPassword } from "~/lib/auth/auth.server";
import type { Route } from "./+types/users";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "user:read");

  const url = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(url);

  const where = { tenantId: auth.tenantId, deletedAt: null } as any;
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
  if (request.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  }

  const auth = await apiAuth(request);
  requireApiPermission(auth, "user:write");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("BAD_REQUEST", "Invalid JSON body");
  }

  const { email, name, username, password } = body;
  if (!email || !password) {
    return jsonError("VALIDATION_ERROR", "email and password are required");
  }

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return jsonError("CONFLICT", "A user with this email already exists", 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      username,
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

  return jsonSuccess(user, 201);
}
