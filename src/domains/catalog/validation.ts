// ===========================================================================
// Catalog Domain — Validation
//
// Zod schemas for validating catalog domain inputs.
// ===========================================================================

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/;

/** Validates a service or category slug */
export const catalogSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .transform((v) => v.toLowerCase())
  .refine((v) => SLUG_REGEX.test(v), {
    message:
      'Slug must be lowercase, start/end with letter or number, and contain only letters, numbers, and hyphens',
  });

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/** Validates input for listing categories */
export const listCategoriesInputSchema = z.object({
  includeInactive: z.boolean().optional().default(false),
});

/** Validates input for listing services */
export const listServicesInputSchema = z.object({
  categoryId: z.string().uuid().optional(),
  includeInactive: z.boolean().optional().default(false),
});

/** Validates a service ID parameter */
export const serviceIdSchema = z.string().uuid();

/** Validates a category ID parameter */
export const categoryIdSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ListCategoriesInputValidated = z.output<
  typeof listCategoriesInputSchema
>;
export type ListServicesInputValidated = z.output<
  typeof listServicesInputSchema
>;
