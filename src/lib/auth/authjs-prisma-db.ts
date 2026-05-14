/**
 * Auth.js Prisma DB Bridge
 *
 * Creates an `AuthjsAdapterDB` from a Prisma-like client.
 * This bridge narrows the full PrismaClient surface to only the
 * delegates needed by the Auth.js adapter: user, account, and
 * verificationToken.
 *
 * Rules:
 * - Does not instantiate PrismaClient
 * - Does not call getPrisma()
 * - No database call at module import time
 * - Does not expose business, businessMembership, auditEvent,
 *   or internal session delegates
 *
 * @module
 */

import type { AuthjsAdapterDB } from './authjs-adapter';

// ---------------------------------------------------------------------------
// Prisma Client shape accepted by the bridge
// ---------------------------------------------------------------------------

/**
 * Minimal Prisma client shape required for Auth.js adapter wiring.
 * Accepts any object that exposes user, account, and verificationToken
 * delegates matching the AuthjsAdapterDB contract.
 *
 * This avoids importing PrismaClient directly, keeping the auth
 * boundary decoupled from infrastructure.
 */
export interface AuthjsPrismaClient {
  user: AuthjsAdapterDB['user'];
  account: AuthjsAdapterDB['account'];
  verificationToken: AuthjsAdapterDB['verificationToken'];
}

// ---------------------------------------------------------------------------
// Bridge factory
// ---------------------------------------------------------------------------

/**
 * Creates an `AuthjsAdapterDB` from a Prisma-like client.
 *
 * Narrows the client to only user, account, and verificationToken.
 * No internal models (business, membership, audit, session) are exposed.
 *
 * @param prisma - A Prisma-like client with user, account, verificationToken
 */
export function createAuthjsAdapterDb(
  prisma: AuthjsPrismaClient,
): AuthjsAdapterDB {
  return {
    user: prisma.user,
    account: prisma.account,
    verificationToken: prisma.verificationToken,
  };
}
