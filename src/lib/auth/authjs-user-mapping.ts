/**
 * Auth.js User Mapping Utilities
 *
 * Pure functions for mapping between Auth.js adapter user payloads
 * and the internal User model contract.
 *
 * Design decisions (TASK-0030B):
 * - Internal User.avatarUrl is canonical; Auth.js `image` maps to it
 * - User.name is required; fallback policy applied for missing provider names
 * - User.email is required; missing email is a hard failure
 * - Provider account id must never become internal User.id
 * - Provider profile data must not override role/status/tenant fields
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields from Auth.js/provider that arrive during user creation */
export interface AdapterUserCreatePayload {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
}

/** Fields from Auth.js/provider that arrive during user update */
export interface AdapterUserUpdatePayload {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
}

/** Internal User shape returned to Auth.js as AdapterUser */
export interface InternalUserForAdapter {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: Date | null;
}

/** Prisma-compatible create input for internal User */
export interface InternalUserCreateInput {
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: Date | null;
}

/** Prisma-compatible update input for internal User (partial) */
export interface InternalUserUpdateInput {
  name?: string;
  avatarUrl?: string | null;
  emailVerified?: Date | null;
}

/** Auth.js AdapterUser shape (returned from adapter methods) */
export interface AdapterUserOutput {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: Date | null;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class AuthjsMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthjsMappingError';
  }
}

// ---------------------------------------------------------------------------
// Email normalization
// ---------------------------------------------------------------------------

/**
 * Normalize and validate an email from Auth.js/provider payload.
 * Trims, lowercases, and rejects missing/null/empty/non-string values.
 *
 * @throws {AuthjsMappingError} if email is missing, null, empty, or non-string
 */
export function normalizeAuthjsEmail(input: unknown): string {
  if (input === null || input === undefined) {
    throw new AuthjsMappingError('Auth.js email is required but was null or undefined');
  }
  if (typeof input !== 'string') {
    throw new AuthjsMappingError('Auth.js email is required but was not a string');
  }
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) {
    throw new AuthjsMappingError('Auth.js email is required but was empty');
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Display name resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a display name for an internal User.
 *
 * Fallback order:
 * 1. Trimmed provider name if non-empty
 * 2. Email local-part before @
 * 3. "User"
 */
export function resolveAuthjsDisplayName(input: {
  name?: string | null;
  email: string;
}): string {
  // 1. Provider name
  if (input.name != null) {
    const trimmed = input.name.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  // 2. Email local-part
  const atIndex = input.email.indexOf('@');
  if (atIndex > 0) {
    return input.email.substring(0, atIndex);
  }
  // 3. Deterministic placeholder
  return 'User';
}

// ---------------------------------------------------------------------------
// Image normalization
// ---------------------------------------------------------------------------

/**
 * Normalize provider image to internal avatarUrl.
 * Accepts non-empty string, returns null for missing/null/empty.
 */
export function normalizeAuthjsImage(input: unknown): string | null {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Internal → Adapter mapping
// ---------------------------------------------------------------------------

/**
 * Map an internal User record to the Auth.js AdapterUser shape.
 * Maps avatarUrl → image for Auth.js consumption.
 */
export function mapInternalUserToAdapterUser(
  user: InternalUserForAdapter,
): AdapterUserOutput {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.avatarUrl,
    emailVerified: user.emailVerified,
  };
}

// ---------------------------------------------------------------------------
// Adapter → Internal mapping (create)
// ---------------------------------------------------------------------------

/**
 * Map an Auth.js adapter user creation payload to internal User create input.
 *
 * Enforces:
 * - Required email (throws on missing)
 * - Name fallback policy
 * - Maps image → avatarUrl
 * - Maps emailVerified
 * - Never allows caller-provided status/role/tenant fields
 * - Never uses provider id as internal User.id
 */
export function mapAdapterUserCreateInput(
  input: AdapterUserCreatePayload,
): InternalUserCreateInput {
  const email = normalizeAuthjsEmail(input.email);
  const name = resolveAuthjsDisplayName({ name: input.name, email });
  const avatarUrl = normalizeAuthjsImage(input.image);
  const emailVerified = input.emailVerified ?? null;

  return {
    email,
    name,
    avatarUrl,
    emailVerified,
  };
}

// ---------------------------------------------------------------------------
// Adapter → Internal mapping (update)
// ---------------------------------------------------------------------------

/**
 * Map an Auth.js adapter user update payload to internal User update input.
 *
 * Only maps allowed profile fields:
 * - Maps image → avatarUrl
 * - Applies name fallback only when context is sufficient
 * - Maps emailVerified
 * - Never updates status/tenant/role
 */
export function mapAdapterUserUpdateInput(
  input: AdapterUserUpdatePayload,
): InternalUserUpdateInput {
  const result: InternalUserUpdateInput = {};

  // Map name if provided
  if (input.name !== undefined) {
    if (input.name !== null) {
      const trimmed = input.name.trim();
      if (trimmed.length > 0) {
        result.name = trimmed;
      }
      // If empty name provided, we don't update (keep existing required name)
    }
    // If null, we don't update (name is required internally)
  }

  // Map image → avatarUrl
  if (input.image !== undefined) {
    result.avatarUrl = normalizeAuthjsImage(input.image);
  }

  // Map emailVerified
  if (input.emailVerified !== undefined) {
    result.emailVerified = input.emailVerified ?? null;
  }

  return result;
}
