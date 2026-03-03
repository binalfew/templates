import { prisma } from "~/lib/db.server";
import { apiAuth, requireApiPermission } from "~/lib/api-auth.server";
import { jsonPaginated, parsePagination } from "~/lib/api-response.server";
import type { Route } from "./+types/tenants";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await apiAuth(request);
  requireApiPermission(auth, "tenant:read");

  const url = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(url);

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        subscriptionPlan: true,
        createdAt: true,
      },
    }),
    prisma.tenant.count(),
  ]);

  return jsonPaginated(tenants, total, page, pageSize);
}
