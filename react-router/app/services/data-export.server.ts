import { prisma } from "~/lib/db.server";

interface ExportOptions {
  entity: string;
  tenantId: string;
  format: "csv" | "json";
  objectId?: string;
}

export async function exportData(options: ExportOptions): Promise<{ content: string; filename: string; contentType: string }> {
  const { entity, tenantId, format, objectId } = options;
  let rows: Record<string, unknown>[];

  switch (entity) {
    case "users": {
      const users = await prisma.user.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      rows = users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username ?? "",
        name: u.name ?? "",
        status: u.status,
        createdAt: u.createdAt.toISOString(),
      }));
      break;
    }
    case "roles": {
      const roles = await prisma.role.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          description: true,
          scope: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
      });
      rows = roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? "",
        scope: r.scope,
        createdAt: r.createdAt.toISOString(),
      }));
      break;
    }
    case "custom-object-records": {
      if (!objectId) throw new Error("objectId is required for custom object records");
      const records = await prisma.customObjectRecord.findMany({
        where: { definitionId: objectId, tenantId },
        select: { id: true, data: true, createdBy: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      rows = records.map((r) => ({
        id: r.id,
        data: JSON.stringify(r.data),
        createdBy: r.createdBy ?? "",
        createdAt: r.createdAt.toISOString(),
      }));
      break;
    }
    default:
      throw new Error(`Unsupported entity: ${entity}`);
  }

  if (format === "json") {
    return {
      content: JSON.stringify(rows, null, 2),
      filename: `${entity}-export.json`,
      contentType: "application/json",
    };
  }

  // CSV format
  if (rows.length === 0) {
    return { content: "", filename: `${entity}-export.csv`, contentType: "text/csv" };
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = String(row[h] ?? "");
        return val.includes(",") || val.includes('"') || val.includes("\n")
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(","),
    ),
  ];

  return {
    content: csvLines.join("\n"),
    filename: `${entity}-export.csv`,
    contentType: "text/csv",
  };
}
