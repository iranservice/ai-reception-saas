// ===========================================================================
// Prisma Client Singleton
//
// Prevents multiple PrismaClient instances during Next.js hot-reload.
// Uses the Prisma 7 driver adapter pattern with @prisma/adapter-pg.
//
// See: https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
// ===========================================================================

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

function createPrismaClient(): PrismaClient {
  if (!connectionString) {
    // In development/test without a database, return a stub client
    // that will fail on first actual query — but won't crash on import.
    return new PrismaClient({
      adapter: new PrismaPg(connectionString as unknown as string),
    });
  }

  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
