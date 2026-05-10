// ===========================================================================
// Identity Domain — Repository
//
// Prisma-backed persistence layer for users and sessions.
// Uses injected Prisma-compatible client for testability.
// ===========================================================================

import { ok, err } from '@/lib/result';
import type { ActionResult } from '@/lib/result';
import type {
  UserIdentity,
  SessionIdentity,
  UserStatusValue,
  CreateUserInput,
  UpdateUserInput,
  CreateSessionInput,
  RevokeSessionInput,
} from './types';
import type {
  FindUserByIdInput,
  FindUserByEmailInput,
  UpdateUserStatusInput,
  FindSessionByIdInput,
  FindSessionByTokenHashInput,
  ListUserSessionsInput,
} from './service';

// ---------------------------------------------------------------------------
// Local record types (match Prisma-selected fields)
// ---------------------------------------------------------------------------

/** Raw user record from the database */
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  locale: string;
  status: UserStatusValue;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Raw session record from the database */
export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Injected DB client interface
// ---------------------------------------------------------------------------

/** Prisma-compatible delegate interface for identity repository */
export interface IdentityRepositoryDb {
  user: {
    create(args: {
      data: {
        email: string;
        name: string;
        locale?: string;
        avatarUrl?: string;
      };
    }): Promise<UserRecord>;
    update(args: {
      where: { id: string };
      data: Partial<{
        name: string;
        locale: string;
        avatarUrl: string | null;
        status: UserStatusValue;
      }>;
    }): Promise<UserRecord>;
    findUnique(args: {
      where: { id: string } | { email: string };
    }): Promise<UserRecord | null>;
  };
  session: {
    create(args: {
      data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        ipAddress?: string;
        userAgent?: string;
      };
    }): Promise<SessionRecord>;
    update(args: {
      where: { id: string };
      data: { revokedAt: Date };
    }): Promise<SessionRecord>;
    findUnique(args: {
      where: { id: string } | { tokenHash: string };
    }): Promise<SessionRecord | null>;
    findMany(args: {
      where: { userId: string; revokedAt?: null };
      orderBy: { createdAt: 'desc' };
    }): Promise<SessionRecord[]>;
  };
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

/** Repository boundary for identity persistence */
export interface IdentityRepository {
  createUser(input: CreateUserInput): Promise<ActionResult<UserIdentity>>;
  updateUser(
    userId: string,
    input: UpdateUserInput,
  ): Promise<ActionResult<UserIdentity>>;
  updateUserStatus(
    input: UpdateUserStatusInput,
  ): Promise<ActionResult<UserIdentity>>;
  findUserById(
    input: FindUserByIdInput,
  ): Promise<ActionResult<UserIdentity | null>>;
  findUserByEmail(
    input: FindUserByEmailInput,
  ): Promise<ActionResult<UserIdentity | null>>;
  createSession(
    input: CreateSessionInput,
  ): Promise<ActionResult<SessionIdentity>>;
  findSessionById(
    input: FindSessionByIdInput,
  ): Promise<ActionResult<SessionIdentity | null>>;
  findSessionByTokenHash(
    input: FindSessionByTokenHashInput,
  ): Promise<ActionResult<SessionIdentity | null>>;
  listUserSessions(
    input: ListUserSessionsInput,
  ): Promise<ActionResult<readonly SessionIdentity[]>>;
  revokeSession(
    input: RevokeSessionInput,
  ): Promise<ActionResult<SessionIdentity>>;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/** Maps a raw user record to a domain UserIdentity */
export function mapUserRecord(record: UserRecord): UserIdentity {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    locale: record.locale,
    status: record.status,
    avatarUrl: record.avatarUrl,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Maps a raw session record to a domain SessionIdentity */
export function mapSessionRecord(record: SessionRecord): SessionIdentity {
  return {
    id: record.id,
    userId: record.userId,
    tokenHash: record.tokenHash,
    expiresAt: record.expiresAt.toISOString(),
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an identity repository backed by the given DB client */
export function createIdentityRepository(
  db: IdentityRepositoryDb,
): IdentityRepository {
  return {
    async createUser(input) {
      try {
        const record = await db.user.create({ data: input });
        return ok(mapUserRecord(record));
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },

    async updateUser(userId, input) {
      try {
        const record = await db.user.update({
          where: { id: userId },
          data: input,
        });
        return ok(mapUserRecord(record));
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },

    async updateUserStatus(input) {
      try {
        const record = await db.user.update({
          where: { id: input.userId },
          data: { status: input.status },
        });
        return ok(mapUserRecord(record));
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },

    async findUserById(input) {
      try {
        const record = await db.user.findUnique({
          where: { id: input.userId },
        });
        return ok(record ? mapUserRecord(record) : null);
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },

    async findUserByEmail(input) {
      try {
        const record = await db.user.findUnique({
          where: { email: input.email },
        });
        return ok(record ? mapUserRecord(record) : null);
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },

    async createSession(input) {
      try {
        const record = await db.session.create({
          data: {
            userId: input.userId,
            tokenHash: input.tokenHash,
            expiresAt: new Date(input.expiresAt),
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        });
        return ok(mapSessionRecord(record));
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },

    async findSessionById(input) {
      try {
        const record = await db.session.findUnique({
          where: { id: input.sessionId },
        });
        return ok(record ? mapSessionRecord(record) : null);
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },

    async findSessionByTokenHash(input) {
      try {
        const record = await db.session.findUnique({
          where: { tokenHash: input.tokenHash },
        });
        return ok(record ? mapSessionRecord(record) : null);
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },

    async listUserSessions(input) {
      try {
        const where: { userId: string; revokedAt?: null } = {
          userId: input.userId,
        };
        if (!input.includeRevoked) {
          where.revokedAt = null;
        }
        const records = await db.session.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });
        return ok(records.map(mapSessionRecord));
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },

    async revokeSession(input) {
      try {
        const revokedAt = input.revokedAt
          ? new Date(input.revokedAt)
          : new Date();
        const record = await db.session.update({
          where: { id: input.sessionId },
          data: { revokedAt },
        });
        return ok(mapSessionRecord(record));
      } catch {
        return err(
          'IDENTITY_REPOSITORY_ERROR',
          'Identity repository operation failed',
        );
      }
    },
  };
}
