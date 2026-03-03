import { data } from "react-router";
import { prisma } from "~/lib/db.server";

/**
 * Resolve a tenant by URL slug.
 * Throws a 404 Response if the slug doesn't match any tenant.
 */
export async function resolveTenant(slug: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { slug },
  });

  if (!tenant) {
    throw data({ error: "Tenant not found" }, { status: 404 });
  }

  return tenant;
}
