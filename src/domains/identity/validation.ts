// ===========================================================================
// Identity Domain — Validation
//
// Zod schemas for validating identity domain inputs.
// ===========================================================================

import { z } from 'zod';
import { USER_STATUS_VALUES } from './types';

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const LOCALE_VALUES = ['en', 'fa'] as const;

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((v) => v.toLowerCase());

const userNameSchema = z.string().trim().min(1).max(120);

const localeSchema = z.enum(LOCALE_VALUES);

const tokenHashSchema = z.string().min(32).max(512);

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

/** Validates a user status value */
export const userStatusSchema = z.enum(USER_STATUS_VALUES);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/** Validates input for creating a new user */
export const createUserInputSchema = z.object({
  email: emailSchema,
  name: userNameSchema,
  locale: localeSchema.optional().default('en'),
  avatarUrl: z.string().url().optional(),
});

/** Validates input for updating a user */
export const updateUserInputSchema = z
  .object({
    name: userNameSchema.optional(),
    locale: localeSchema.optional(),
    avatarUrl: z.string().url().nullable().optional(),
    status: userStatusSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.locale !== undefined ||
      data.avatarUrl !== undefined ||
      data.status !== undefined,
    { message: 'At least one field must be provided for update' },
  );

/** Validates input for creating a session */
export const createSessionInputSchema = z.object({
  userId: z.string().uuid(),
  tokenHash: tokenHashSchema,
  expiresAt: z.string().datetime(),
  ipAddress: z.string().max(128).optional(),
  userAgent: z.string().max(512).optional(),
});

/** Validates input for revoking a session */
export const revokeSessionInputSchema = z.object({
  sessionId: z.string().uuid(),
  revokedAt: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateUserInputValidated = z.output<typeof createUserInputSchema>;
export type UpdateUserInputValidated = z.output<typeof updateUserInputSchema>;
export type CreateSessionInputValidated = z.output<
  typeof createSessionInputSchema
>;
export type RevokeSessionInputValidated = z.output<
  typeof revokeSessionInputSchema
>;
