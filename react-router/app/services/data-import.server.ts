import { prisma } from "~/lib/db.server";
import { hashPassword } from "~/lib/auth.server";
import { logger } from "~/lib/logger.server";

interface ImportRow {
  [key: string]: string;
}

export interface ImportResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: Array<{ row: number; message: string }>;
  imported: number;
}

export function parseCsv(content: string): ImportRow[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: ImportRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

export function parseJson(content: string): ImportRow[] {
  const data = JSON.parse(content);
  if (!Array.isArray(data)) throw new Error("JSON must be an array");
  return data;
}

export async function importData(options: {
  entity: string;
  tenantId: string;
  rows: ImportRow[];
  dryRun: boolean;
  userId: string;
  objectId?: string;
}): Promise<ImportResult> {
  const { entity, tenantId, rows, dryRun, userId, objectId } = options;
  const result: ImportResult = {
    totalRows: rows.length,
    validRows: 0,
    errorRows: 0,
    errors: [],
    imported: 0,
  };

  const BATCH_SIZE = 100;

  switch (entity) {
    case "users": {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.email) {
          result.errors.push({ row: i + 1, message: "email is required" });
          result.errorRows++;
          continue;
        }
        const existing = await prisma.user.findFirst({ where: { email: row.email } });
        if (existing) {
          result.errors.push({ row: i + 1, message: `email ${row.email} already exists` });
          result.errorRows++;
          continue;
        }
        result.validRows++;
      }

      if (!dryRun) {
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          for (const row of batch) {
            if (!row.email) continue;
            const existing = await prisma.user.findFirst({ where: { email: row.email } });
            if (existing) continue;
            try {
              const passwordHash = await hashPassword(row.password || "Changeme1!");
              await prisma.user.create({
                data: {
                  email: row.email,
                  name: row.name || null,
                  username: row.username || null,
                  tenantId,
                  password: { create: { hash: passwordHash } },
                },
              });
              result.imported++;
            } catch (err) {
              logger.error({ email: row.email, err }, "Import: failed to create user");
            }
          }
        }
      }
      break;
    }

    case "roles": {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.name) {
          result.errors.push({ row: i + 1, message: "name is required" });
          result.errorRows++;
          continue;
        }
        result.validRows++;
      }

      if (!dryRun) {
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          for (const row of batch) {
            if (!row.name) continue;
            try {
              await prisma.role.create({
                data: {
                  tenantId,
                  name: row.name,
                  description: row.description || null,
                  scope: (row.scope as "GLOBAL" | "TENANT" | "EVENT") || "TENANT",
                },
              });
              result.imported++;
            } catch (err) {
              logger.error({ name: row.name, err }, "Import: failed to create role");
            }
          }
        }
      }
      break;
    }

    case "custom-object-records": {
      if (!objectId) throw new Error("objectId required");
      for (let i = 0; i < rows.length; i++) {
        result.validRows++;
      }

      if (!dryRun) {
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          for (const row of batch) {
            try {
              const data = row.data ? JSON.parse(row.data) : row;
              await prisma.customObjectRecord.create({
                data: {
                  definitionId: objectId,
                  tenantId,
                  data,
                  createdBy: userId,
                },
              });
              result.imported++;
            } catch (err) {
              logger.error({ err }, "Import: failed to create custom object record");
            }
          }
        }
      }
      break;
    }

    default:
      throw new Error(`Unsupported entity: ${entity}`);
  }

  return result;
}
