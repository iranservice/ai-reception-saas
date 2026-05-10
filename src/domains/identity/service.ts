// ===========================================================================
// Identity Domain — Service Interface
//
// Pure service boundary for identity operations.
// No implementation — interface definitions only.
// ===========================================================================

import type { ActionResult } from '@/lib/result';
import type {
  UserIdentity,
  SessionIdentity,
  CreateUserInput,
  UpdateUserInput,
  CreateSessionInput,
  RevokeSessionInput,
  UserStatusValue,
} from './types';

// ---------------------------------------------------------------------------
// Service-specific input types
// ---------------------------------------------------------------------------

/** Input for finding a user by ID */
export interface FindUserByIdInput {
  readonly userId: string;
}

/** Input for finding a user by email */
export interface FindUserByEmailInput {
  readonly email: string;
}

/** Input for updating a user's status */
export interface UpdateUserStatusInput {
  readonly userId: string;
  readonly status: UserStatusValue;
}

/** Input for finding a session by ID */
export interface FindSessionByIdInput {
  readonly sessionId: string;
}

/** Input for finding a session by token hash */
export interface FindSessionByTokenHashInput {
  readonly tokenHash: string;
}

/** Input for listing a user's sessions */
export interface ListUserSessionsInput {
  readonly userId: string;
  readonly includeRevoked?: boolean;
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/** Identity service error code constants */
export const IDENTITY_ERROR_CODES = [
  'USER_NOT_FOUND',
  'USER_EMAIL_ALREADY_EXISTS',
  'SESSION_NOT_FOUND',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'INVALID_IDENTITY_INPUT',
] as const;

/** Identity service error code type */
export type IdentityErrorCode = (typeof IDENTITY_ERROR_CODES)[number];

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/** Service boundary for identity (user + session) operations */
export interface IdentityService {
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
