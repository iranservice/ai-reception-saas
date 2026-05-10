// ===========================================================================
// Identity Domain — Service Implementation
//
// Concrete IdentityService backed by validation + injected repository.
// ===========================================================================

import { z } from 'zod';
import { err } from '@/lib/result';
import type { IdentityService } from './service';
import type { IdentityRepository } from './repository';
import {
  createUserInputSchema,
  updateUserInputSchema,
  createSessionInputSchema,
  revokeSessionInputSchema,
  userStatusSchema,
} from './validation';

// ---------------------------------------------------------------------------
// Local validation helpers
// ---------------------------------------------------------------------------

const uuidSchema = z.string().uuid();
const emailSchema = z.string().trim().email().max(320).transform((v) => v.toLowerCase());
const tokenHashFieldSchema = z.string().min(32).max(512);

const updateUserStatusInputSchema = z.object({
  userId: uuidSchema,
  status: userStatusSchema,
});

const findSessionByTokenHashInputSchema = z.object({
  tokenHash: tokenHashFieldSchema,
});

const listUserSessionsInputSchema = z.object({
  userId: uuidSchema,
  includeRevoked: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

/** Dependencies for the identity service */
export interface IdentityServiceDeps {
  readonly repository: IdentityRepository;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a concrete IdentityService with validation and injected repository */
export function createIdentityService(deps: IdentityServiceDeps): IdentityService {
  const { repository } = deps;

  return {
    async createUser(input) {
      const parsed = createUserInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.createUser(parsed.data);
    },

    async updateUser(userId, input) {
      const userIdResult = uuidSchema.safeParse(userId);
      if (!userIdResult.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      const parsed = updateUserInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.updateUser(userIdResult.data, parsed.data);
    },

    async updateUserStatus(input) {
      const parsed = updateUserStatusInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.updateUserStatus(parsed.data);
    },

    async findUserById(input) {
      const parsed = uuidSchema.safeParse(input.userId);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.findUserById(input);
    },

    async findUserByEmail(input) {
      const parsed = emailSchema.safeParse(input.email);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.findUserByEmail({ email: parsed.data });
    },

    async createSession(input) {
      const parsed = createSessionInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.createSession(parsed.data);
    },

    async findSessionById(input) {
      const parsed = uuidSchema.safeParse(input.sessionId);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.findSessionById(input);
    },

    async findSessionByTokenHash(input) {
      const parsed = findSessionByTokenHashInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.findSessionByTokenHash(parsed.data);
    },

    async listUserSessions(input) {
      const parsed = listUserSessionsInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.listUserSessions(parsed.data);
    },

    async revokeSession(input) {
      const parsed = revokeSessionInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_IDENTITY_INPUT', 'Invalid identity input');
      }
      return repository.revokeSession(parsed.data);
    },
  };
}
