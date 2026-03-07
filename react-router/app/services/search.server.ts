import { prisma } from "~/utils/db/db.server";

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  url: string;
  score?: number;
}

export interface SearchResults {
  results: SearchResult[];
  total: number;
  query: string;
}

export async function globalSearch(
  query: string,
  tenantId: string,
  options: { limit?: number; page?: number } = {},
): Promise<SearchResults> {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = ((options.page ?? 1) - 1) * limit;

  if (!query || query.trim().length < 2) {
    return { results: [], total: 0, query };
  }

  const term = query.trim();
  const contains = { contains: term, mode: "insensitive" as const };

  const [users, roles, permissions, customObjects, auditLogs] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ name: contains }, { email: contains }, { username: contains }],
      },
      select: { id: true, name: true, email: true, username: true },
      take: limit,
    }),
    prisma.role.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ name: contains }, { description: contains }],
      },
      select: { id: true, name: true, description: true },
      take: limit,
    }),
    prisma.permission.findMany({
      where: {
        OR: [{ resource: contains }, { action: contains }, { description: contains }],
      },
      select: { id: true, resource: true, action: true, description: true },
      take: limit,
    }),
    prisma.customObjectDefinition.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ name: contains }, { slug: contains }, { description: contains }],
      },
      select: { id: true, name: true, slug: true, description: true },
      take: limit,
    }),
    prisma.auditLog.findMany({
      where: {
        tenantId,
        OR: [{ description: contains }, { entityType: contains }],
      },
      select: { id: true, action: true, entityType: true, description: true, createdAt: true },
      take: Math.min(limit, 10),
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const results: SearchResult[] = [
    ...users.map((u) => ({
      id: u.id,
      type: "User",
      title: u.name ?? u.email,
      subtitle: u.email,
      url: `security/users/${u.id}`,
      score: scoreMatch(term, [u.name, u.email, u.username]),
    })),
    ...roles.map((r) => ({
      id: r.id,
      type: "Role",
      title: r.name,
      subtitle: r.description ?? undefined,
      url: `security/roles/${r.id}`,
      score: scoreMatch(term, [r.name, r.description]),
    })),
    ...permissions.map((p) => ({
      id: p.id,
      type: "Permission",
      title: `${p.resource}:${p.action}`,
      subtitle: p.description ?? undefined,
      url: `security/permissions/${p.id}`,
      score: scoreMatch(term, [p.resource, p.action, p.description]),
    })),
    ...customObjects.map((co) => ({
      id: co.id,
      type: "CustomObject",
      title: co.name,
      subtitle: co.description ?? co.slug,
      url: `objects/${co.slug}`,
      score: scoreMatch(term, [co.name, co.slug, co.description]),
    })),
    ...auditLogs.map((al) => ({
      id: al.id,
      type: "AuditLog",
      title: `${al.action} ${al.entityType}`,
      subtitle: al.description ?? undefined,
      url: `logs`,
      score: scoreMatch(term, [al.action, al.entityType, al.description]),
    })),
  ];

  // Sort by relevance score (descending)
  results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const paginated = results.slice(offset, offset + limit);
  return { results: paginated, total: results.length, query };
}

function scoreMatch(query: string, fields: (string | null | undefined)[]): number {
  const q = query.toLowerCase();
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    const lower = f.toLowerCase();
    if (lower === q) return 1.0; // exact match
    if (lower.startsWith(q)) best = Math.max(best, 0.8);
    else if (lower.includes(q)) best = Math.max(best, 0.5);
  }
  return best;
}
