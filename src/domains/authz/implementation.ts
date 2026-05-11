// ===========================================================================
// Authz Domain — Service Implementation
//
// Concrete AuthzService using pure permission helpers.
// No database, no repository — fully stateless.
// ===========================================================================

import { ok, err } from '@/lib/result';
import type { AuthzService } from './service';
import { accessCheckInputSchema, authzPermissionSchema } from './validation';
import { membershipRoleSchema } from '../tenancy/validation';
import {
  evaluateAccess as evaluateAccessPure,
  isSensitivePermission as isSensitivePermissionPure,
  ROLE_PERMISSIONS,
} from './permissions';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a concrete AuthzService backed by pure permission helpers */
export function createAuthzService(): AuthzService {
  return {
    async evaluateAccess(input) {
      const parsed = accessCheckInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_AUTHZ_INPUT', 'Invalid authorization input');
      }
      return ok(evaluateAccessPure(parsed.data));
    },

    async requirePermission(input) {
      const parsed = accessCheckInputSchema.safeParse(input);
      if (!parsed.success) {
        return err('INVALID_AUTHZ_INPUT', 'Invalid authorization input');
      }
      const decision = evaluateAccessPure(parsed.data);
      if (!decision.allowed) {
        return err('ACCESS_DENIED', decision.reason ?? 'Access denied');
      }
      return ok(decision);
    },

    async listRolePermissions(input) {
      const parsed = membershipRoleSchema.safeParse(input.role);
      if (!parsed.success) {
        return err('INVALID_AUTHZ_INPUT', 'Invalid authorization input');
      }
      return ok(ROLE_PERMISSIONS[parsed.data]);
    },

    async isSensitivePermission(permission) {
      const parsed = authzPermissionSchema.safeParse(permission);
      if (!parsed.success) {
        return err('UNKNOWN_PERMISSION', 'Unknown permission');
      }
      return ok(isSensitivePermissionPure(parsed.data));
    },
  };
}
