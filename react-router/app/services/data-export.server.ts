import { prisma } from "~/utils/db/db.server";

interface ExportOptions {
  entity: string;
  tenantId: string;
  format: "csv" | "json";
}

export async function exportData(options: ExportOptions): Promise<{ content: string; filename: string; contentType: string }> {
  const { entity, tenantId, format } = options;
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
    case "countries": {
      const countries = await prisma.country.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          alpha3: true,
          numericCode: true,
          phoneCode: true,
          flag: true,
          sortOrder: true,
          isActive: true,
        },
        orderBy: { sortOrder: "asc" },
      });
      rows = countries.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        alpha3: c.alpha3 ?? "",
        numericCode: c.numericCode ?? "",
        phoneCode: c.phoneCode ?? "",
        flag: c.flag ?? "",
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      }));
      break;
    }
    case "titles": {
      const titles = await prisma.title.findMany({
        select: { id: true, code: true, name: true, sortOrder: true, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      rows = titles.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        sortOrder: t.sortOrder,
        isActive: t.isActive,
      }));
      break;
    }
    case "languages": {
      const languages = await prisma.language.findMany({
        select: { id: true, code: true, name: true, nativeName: true, sortOrder: true, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      rows = languages.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        nativeName: l.nativeName ?? "",
        sortOrder: l.sortOrder,
        isActive: l.isActive,
      }));
      break;
    }
    case "currencies": {
      const currencies = await prisma.currency.findMany({
        select: { id: true, code: true, name: true, symbol: true, decimalDigits: true, sortOrder: true, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      rows = currencies.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        symbol: c.symbol ?? "",
        decimalDigits: c.decimalDigits,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      }));
      break;
    }
    case "document-types": {
      const docTypes = await prisma.documentType.findMany({
        select: { id: true, code: true, name: true, description: true, category: true, sortOrder: true, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      rows = docTypes.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        description: d.description ?? "",
        category: d.category ?? "",
        sortOrder: d.sortOrder,
        isActive: d.isActive,
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
