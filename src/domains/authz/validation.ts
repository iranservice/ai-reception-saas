// ===========================================================================
// Authz Domain — Validation
//
// Zod schemas for validating authz inputs.
// ===========================================================================

import { z } from 'zod';
import { AUTHZ_PERMISSION_VALUES } from './types';
import { membershipRoleSchema } from '../tenancy/validation';

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

/** Validates a known permission */
export const authzPermissionSchema = z.enum(AUTHZ_PERMISSION_VALUES);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/** Validates an access check input */
export const accessCheckInputSchema = z.object({
  userId: z.string().uuid(),
  businessId: z.string().uuid(),
  role: membershipRoleSchema,
  permission: authzPermissionSchema,
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type AccessCheckInputValidated = z.output<
  typeof accessCheckInputSchema
>;
