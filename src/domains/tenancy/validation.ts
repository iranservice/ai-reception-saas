// ===========================================================================
// Tenancy Domain — Validation
//
// Zod schemas for validating tenancy domain inputs.
// ===========================================================================

import { z } from 'zod';
import {
  BUSINESS_STATUS_VALUES,
  MEMBERSHIP_STATUS_VALUES,
  MEMBERSHIP_ROLE_VALUES,
} from './types';

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const LOCALE_VALUES = ['en', 'fa'] as const;

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/;

const businessSlugBaseSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .transform((v) => v.toLowerCase())
  .refine((v) => SLUG_REGEX.test(v), {
    message:
      'Slug must be lowercase, start/end with letter or number, and contain only letters, numbers, and hyphens',
  });

const businessNameSchema = z.string().trim().min(2).max(120);

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

/** Validates a business status value */
export const businessStatusSchema = z.enum(BUSINESS_STATUS_VALUES);

/** Validates a membership status value */
export const membershipStatusSchema = z.enum(MEMBERSHIP_STATUS_VALUES);

/** Validates a membership role value */
export const membershipRoleSchema = z.enum(MEMBERSHIP_ROLE_VALUES);

/** Validates a business slug */
export const businessSlugSchema = businessSlugBaseSchema;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/** Validates input for creating a new business */
export const createBusinessInputSchema = z.object({
  name: businessNameSchema,
  slug: businessSlugBaseSchema,
  createdByUserId: z.string().uuid(),
  timezone: z.string().min(1).max(64).optional().default('Asia/Tehran'),
  locale: z.enum(LOCALE_VALUES).optional().default('fa'),
});

/** Validates input for updating a business */
export const updateBusinessInputSchema = z
  .object({
    businessId: z.string().uuid(),
    name: businessNameSchema.optional(),
    slug: businessSlugBaseSchema.optional(),
    status: businessStatusSchema.optional(),
    timezone: z.string().min(1).max(64).optional(),
    locale: z.enum(LOCALE_VALUES).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.slug !== undefined ||
      data.status !== undefined ||
      data.timezone !== undefined ||
      data.locale !== undefined,
    {
      message:
        'At least one update field must be provided in addition to businessId',
    },
  );

/** Validates input for creating a membership */
export const createMembershipInputSchema = z.object({
  businessId: z.string().uuid(),
  userId: z.string().uuid(),
  role: membershipRoleSchema.optional().default('VIEWER'),
  status: membershipStatusSchema.optional().default('INVITED'),
  invitedByUserId: z.string().uuid().optional(),
});

/** Validates input for updating a membership role */
export const updateMembershipRoleInputSchema = z.object({
  membershipId: z.string().uuid(),
  role: membershipRoleSchema,
});

/** Validates input for updating a membership status */
export const updateMembershipStatusInputSchema = z.object({
  membershipId: z.string().uuid(),
  status: membershipStatusSchema,
  joinedAt: z.string().datetime().optional(),
});

/** Validates input for resolving tenant context */
export const resolveTenantContextInputSchema = z.object({
  userId: z.string().uuid(),
  businessId: z.string().uuid(),
});

/** Validates a resolved tenant context */
export const tenantContextSchema = z.object({
  businessId: z.string().uuid(),
  userId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: membershipRoleSchema,
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateBusinessInputValidated = z.output<
  typeof createBusinessInputSchema
>;
export type UpdateBusinessInputValidated = z.output<
  typeof updateBusinessInputSchema
>;
export type CreateMembershipInputValidated = z.output<
  typeof createMembershipInputSchema
>;
export type TenantContextValidated = z.output<typeof tenantContextSchema>;
