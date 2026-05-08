// ===========================================================================
// Prisma Client Singleton
//
// Prevents multiple PrismaClient instances during Next.js hot-reload.
// Uses the Prisma 7 driver adapter pattern with @prisma/adapter-pg.
//
// Lazy initialization: getPrisma() throws if DATABASE_URL is missing.
// Importing this module will NOT crash during build/test.
// ===========================================================================

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrisma(): PrismaClient {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize Prisma Client.');
  }

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(env.databaseUrl);

    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    });
  }

  return globalForPrisma.prisma;
}
