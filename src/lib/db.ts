import { PrismaClient } from "@prisma/client";

/**
 * One Prisma client per process. Next's dev server hot-reloads modules, which
 * would otherwise open a new SQLite connection on every save until the process
 * runs out of handles.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
