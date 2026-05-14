/**
 * Auth.js Adapter Wrapper Boundary
 *
 * A thin custom adapter that wraps Auth.js persistence operations while
 * preserving the internal User model contract.
 *
 * Design decisions:
 * - Delegates Account and VerificationToken to standard Prisma operations
 * - Normalizes provider user/profile data before writing User
 * - Maps provider `image` to internal `avatarUrl`
 * - Enforces required `email` (hard failure if missing)
 * - Provides fallback `name`
 * - Disables database session methods (JWT strategy)
 * - Does not import getPrisma() or instantiate PrismaClient
 * - Receives a minimal DB interface via dependency injection
 *
 * @module
 */

import type { Adapter } from 'next-auth/adapters';
import {
  mapAdapterUserCreateInput,
  mapAdapterUserUpdateInput,
  mapInternalUserToAdapterUser,
  normalizeAuthjsEmail,
  normalizeAuthjsImage,
  type InternalUserForAdapter,
} from './authjs-user-mapping';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTHJS_DATABASE_SESSIONS_DISABLED_MESSAGE =
  'Auth.js database sessions are disabled; use JWT session strategy.';

// ---------------------------------------------------------------------------
// DB Interface (injected, not imported)
// ---------------------------------------------------------------------------

/**
 * Minimal DB interface for the Auth.js adapter.
 * Covers only user, account, and verificationToken delegates.
 * Does not include business, businessMembership, auditEvent, or internal session.
 */
export interface AuthjsAdapterDB {
  user: {
    create(args: {
      data: {
        email: string;
        name: string;
        avatarUrl: string | null;
        emailVerified: Date | null;
      };
    }): Promise<InternalUserForAdapter>;

    findUnique(args: {
      where: { id: string } | { email: string };
    }): Promise<InternalUserForAdapter | null>;

    update(args: {
      where: { id: string };
      data: {
        name?: string;
        avatarUrl?: string | null;
        emailVerified?: Date | null;
      };
    }): Promise<InternalUserForAdapter>;
  };

  account: {
    create(args: {
      data: {
        userId: string;
        type: string;
        provider: string;
        providerAccountId: string;
        refreshToken?: string | null;
        accessToken?: string | null;
        expiresAt?: number | null;
        tokenType?: string | null;
        scope?: string | null;
        idToken?: string | null;
        sessionState?: string | null;
      };
    }): Promise<unknown>;

    findUnique(args: {
      where: {
        provider_providerAccountId: {
          provider: string;
          providerAccountId: string;
        };
      };
      include?: { user: boolean };
    }): Promise<
      | (Record<string, unknown> & { user?: InternalUserForAdapter })
      | null
    >;

    delete(args: {
      where: {
        provider_providerAccountId: {
          provider: string;
          providerAccountId: string;
        };
      };
    }): Promise<unknown>;
  };

  verificationToken: {
    create(args: {
      data: {
        identifier: string;
        token: string;
        expires: Date;
      };
    }): Promise<{ identifier: string; token: string; expires: Date }>;

    findUnique(args: {
      where: {
        identifier_token: {
          identifier: string;
          token: string;
        };
      };
    }): Promise<{ identifier: string; token: string; expires: Date } | null>;

    delete(args: {
      where: {
        identifier_token: {
          identifier: string;
          token: string;
        };
      };
    }): Promise<{ identifier: string; token: string; expires: Date }>;
  };
}

// ---------------------------------------------------------------------------
// Helper: unsupported database session method
// ---------------------------------------------------------------------------

/**
 * Creates a function that throws when called, indicating database sessions
 * are disabled in favor of JWT strategy.
 */
export function createUnsupportedDatabaseSessionMethod(
  methodName: string,
): () => never {
  return () => {
    throw new Error(
      `${methodName}: ${AUTHJS_DATABASE_SESSIONS_DISABLED_MESSAGE}`,
    );
  };
}

// ---------------------------------------------------------------------------
// Account field mapping
// ---------------------------------------------------------------------------

/**
 * Maps Auth.js AdapterAccount fields to internal Prisma Account fields.
 * Auth.js may use snake_case (access_token) or camelCase (accessToken).
 */
function mapAccountFields(account: Record<string, unknown>) {
  return {
    userId: account.userId as string,
    type: account.type as string,
    provider: account.provider as string,
    providerAccountId: account.providerAccountId as string,
    refreshToken:
      (account.refresh_token as string | null | undefined) ??
      (account.refreshToken as string | null | undefined) ??
      null,
    accessToken:
      (account.access_token as string | null | undefined) ??
      (account.accessToken as string | null | undefined) ??
      null,
    expiresAt:
      (account.expires_at as number | null | undefined) ??
      (account.expiresAt as number | null | undefined) ??
      null,
    tokenType:
      (account.token_type as string | null | undefined) ??
      (account.tokenType as string | null | undefined) ??
      null,
    scope: (account.scope as string | null | undefined) ?? null,
    idToken:
      (account.id_token as string | null | undefined) ??
      (account.idToken as string | null | undefined) ??
      null,
    sessionState:
      (account.session_state as string | null | undefined) ??
      (account.sessionState as string | null | undefined) ??
      null,
  };
}

// ---------------------------------------------------------------------------
// Error classification helper
// ---------------------------------------------------------------------------

/**
 * Checks if an error is a Prisma "record not found" error (P2025).
 * Does not import PrismaClient — inspects error shape only.
 */
function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

// ---------------------------------------------------------------------------
// Adapter Factory
// ---------------------------------------------------------------------------

/**
 * Creates an Auth.js-compatible Adapter backed by the provided DB interface.
 *
 * The adapter:
 * - Uses internal User with avatarUrl (not image)
 * - Enforces required email and name fallback
 * - Delegates Account and VerificationToken directly
 * - Omits database session methods (JWT strategy)
 */
export function createAuthjsAdapter(db: AuthjsAdapterDB): Adapter {
  return {
    // -----------------------------------------------------------------------
    // User methods
    // -----------------------------------------------------------------------

    async createUser(user) {
      const input = mapAdapterUserCreateInput({
        email: user.email,
        name: user.name,
        // Auth.js User type includes `image` but AdapterUser interface
        // lacks an index signature, requiring intermediate `unknown` cast.
        image: normalizeAuthjsImage((user as unknown as Record<string, unknown>).image),
        emailVerified: user.emailVerified,
      });

      const created = await db.user.create({ data: input });
      return mapInternalUserToAdapterUser(created);
    },

    async getUser(id) {
      const user = await db.user.findUnique({ where: { id } });
      if (!user) return null;
      return mapInternalUserToAdapterUser(user);
    },

    async getUserByEmail(email) {
      const normalized = normalizeAuthjsEmail(email);
      const user = await db.user.findUnique({ where: { email: normalized } });
      if (!user) return null;
      return mapInternalUserToAdapterUser(user);
    },

    async updateUser(user) {
      const updateData = mapAdapterUserUpdateInput({
        id: user.id,
        name: user.name,
        // See createUser comment for cast rationale
        image: normalizeAuthjsImage((user as unknown as Record<string, unknown>).image),
        emailVerified: user.emailVerified,
      });

      const updated = await db.user.update({
        where: { id: user.id },
        data: updateData,
      });
      return mapInternalUserToAdapterUser(updated);
    },

    // deleteUser is intentionally omitted.
    // Internal User lifecycle is application-owned; Auth.js must not
    // perform destructive user deletion. The Adapter interface declares
    // deleteUser as optional.

    // -----------------------------------------------------------------------
    // Account methods
    // -----------------------------------------------------------------------

    async linkAccount(account) {
      const mapped = mapAccountFields(account as unknown as Record<string, unknown>);
      await db.account.create({ data: mapped });
    },

    async getUserByAccount(providerAccountId) {
      const account = await db.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: providerAccountId.provider,
            providerAccountId: providerAccountId.providerAccountId,
          },
        },
        include: { user: true },
      });

      if (!account?.user) return null;
      return mapInternalUserToAdapterUser(account.user);
    },

    async unlinkAccount(providerAccountId) {
      await db.account.delete({
        where: {
          provider_providerAccountId: {
            provider: providerAccountId.provider,
            providerAccountId: providerAccountId.providerAccountId,
          },
        },
      });
    },

    // -----------------------------------------------------------------------
    // Verification token methods
    // -----------------------------------------------------------------------

    async createVerificationToken(verificationToken) {
      const created = await db.verificationToken.create({
        data: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
          expires: verificationToken.expires,
        },
      });
      return created;
    },

    async useVerificationToken(params) {
      try {
        const deleted = await db.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: params.identifier,
              token: params.token,
            },
          },
        });
        return deleted;
      } catch (error: unknown) {
        // Return null only for record-not-found (Prisma P2025).
        // All other DB errors must propagate for safety.
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },

    // -----------------------------------------------------------------------
    // Database session methods — DISABLED (JWT strategy)
    // -----------------------------------------------------------------------
    // All session methods are omitted because the Adapter interface
    // declares them as optional. Auth.js JWT strategy does not call them.
    // If called unexpectedly, Auth.js will show an appropriate error.
  };
}
