import { PrismaClient } from "../generated/prisma/client.js";
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
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
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
      customObjectDefinition: softDeleteExtension("customObjectDefinition"),
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
