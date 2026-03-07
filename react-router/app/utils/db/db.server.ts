import pg from "pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Models that support soft delete via a `deletedAt` timestamp column.
 * When a record is soft-deleted, `deletedAt` is set to the current time.
 * All standard queries automatically filter out soft-deleted records.
 *
 * To include soft-deleted records, pass `includeDeleted: true` in the args:
 *   prisma.user.findMany({ includeDeleted: true } as any)
 */

function addSoftDeleteFilter(args: { where?: Record<string, unknown> }, includeDeleted: boolean) {
  if (!includeDeleted) {
    args.where = { ...args.where, deletedAt: null };
  }
}

function createBasePrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    min: Number(process.env.DATABASE_POOL_MIN) || 2,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT) || 10_000,
    statement_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT) || 5_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function softDeleteExtension(modelName: string) {
  return {
    async findMany({ args, query }: any) {
      const includeDeleted = (args as any).includeDeleted === true;
      delete (args as any).includeDeleted;
      addSoftDeleteFilter(args, includeDeleted);
      return query(args);
    },
    async findFirst({ args, query }: any) {
      const includeDeleted = (args as any).includeDeleted === true;
      delete (args as any).includeDeleted;
      addSoftDeleteFilter(args, includeDeleted);
      return query(args);
    },
    async count({ args, query }: any) {
      const includeDeleted = (args as any).includeDeleted === true;
      delete (args as any).includeDeleted;
      addSoftDeleteFilter(args, includeDeleted);
      return query(args);
    },
  };
}

function withSoftDelete(client: PrismaClient) {
  return client.$extends({
    query: {
      user: softDeleteExtension("user"),
      role: softDeleteExtension("role"),
      webhookSubscription: softDeleteExtension("webhookSubscription"),
    },
  });
}

function createPrismaClient() {
  const base = createBasePrismaClient();
  return withSoftDelete(base);
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
