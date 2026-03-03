import { prisma } from "~/lib/db/db.server";
import { apiAuth, requireApiPermission } from "~/lib/auth/api-auth.server";
import { jsonPaginated, parsePagination } from "~/lib/api-response.server";
import type { Route } from "./+types/permissions";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "role:read");

  const url = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(url);

  const [permissions, total] = await Promise.all([
    prisma.permission.findMany({
      skip,
      take: pageSize,
      orderBy: [{ resource: "asc" }, { action: "asc" }],
      select: { id: true, resource: true, action: true, description: true },
    }),
    prisma.permission.count(),
  ]);

  return jsonPaginated(permissions, total, page, pageSize);
}
