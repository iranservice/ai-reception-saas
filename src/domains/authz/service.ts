// ===========================================================================
// Authz Domain — Service Interface
//
// Pure service boundary for authorization operations.
// No implementation — interface definitions only.
// ===========================================================================

import type { ActionResult } from '@/lib/result';
import type { MembershipRoleValue } from '../tenancy/types';
import type {
  AccessCheckInput,
  AccessDecision,
  AuthzPermission,
} from './types';

// ---------------------------------------------------------------------------
// Service-specific input types
// ---------------------------------------------------------------------------

/** Input for listing permissions of a role */
export interface ListRolePermissionsInput {
  readonly role: MembershipRoleValue;
}

/** Input for requiring a permission (throws-equivalent via result) */
export interface RequirePermissionInput {
  readonly userId: string;
  readonly businessId: string;
  readonly role: MembershipRoleValue;
  readonly permission: AuthzPermission;
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/** Authz service error code constants */
export const AUTHZ_ERROR_CODES = [
  'ACCESS_DENIED',
  'UNKNOWN_PERMISSION',
  'INVALID_AUTHZ_INPUT',
] as const;

/** Authz service error code type */
export type AuthzErrorCode = (typeof AUTHZ_ERROR_CODES)[number];

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/** Service boundary for authorization operations */
export interface AuthzService {
  evaluateAccess(
    input: AccessCheckInput,
  ): Promise<ActionResult<AccessDecision>>;

  requirePermission(
    input: RequirePermissionInput,
  ): Promise<ActionResult<AccessDecision>>;

  listRolePermissions(
    input: ListRolePermissionsInput,
  ): Promise<ActionResult<readonly AuthzPermission[]>>;

  isSensitivePermission(
    permission: AuthzPermission,
  ): Promise<ActionResult<boolean>>;
}
