// ===========================================================================
// Authz — API Handler Module
//
// Handler builders for authz operations.
// Uses dependency injection for testability.
// Context resolution must succeed before any service call.
// Evaluate/require use tenant context userId/businessId/role, not body.
// Role permissions require authenticated context only.
// ===========================================================================

import { z } from 'zod';
import { actionResultToResponse } from '@/app/api/_shared/action-result';
import { validateJsonBody } from '@/app/api/_shared/request';
import { validateRouteParams } from '@/app/api/_shared/params';
import {
  resolveTenantRequestContext,
  resolveAuthenticatedRequestContext,
  type TenantRequestContext,
  type TenantRequestScope,
  type AuthenticatedUserRequestContext,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import type { AuthzService } from '@/domains/authz/service';
import { authzPermissionSchema } from '@/domains/authz/validation';
import { membershipRoleSchema } from '@/domains/tenancy/validation';

// ---------------------------------------------------------------------------
// Local schemas
// ---------------------------------------------------------------------------

const authzPermissionRequestBodySchema = z
  .object({
    permission: authzPermissionSchema,
  })
  .strict();

const rolePermissionsParamsSchema = z.object({
  role: membershipRoleSchema,
});

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

/** Dependencies required by the authz handler module */
export interface AuthzApiHandlerDeps {
  readonly authzService: Pick<
    AuthzService,
    'evaluateAccess' | 'requirePermission' | 'listRolePermissions'
  >;
  readonly resolveTenantContext?: (
    request: Request,
    scope?: TenantRequestScope,
  ) => Promise<ContextResult<TenantRequestContext>>;
  readonly resolveAuthenticatedContext?: (
    request: Request,
  ) => Promise<ContextResult<AuthenticatedUserRequestContext>>;
}

// ---------------------------------------------------------------------------
// Handler builders
// ---------------------------------------------------------------------------

/**
 * POST /api/authz/evaluate
 *
 * 1. Resolve tenant context
 * 2. Validate JSON body (permission only)
 * 3. Call evaluateAccess with context userId/businessId/role
 */
export function createPostAuthzEvaluateHandler(
  deps: AuthzApiHandlerDeps,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const resolve = deps.resolveTenantContext ?? resolveTenantRequestContext;
    const contextResult = await resolve(request);
    if (!contextResult.ok) return contextResult.response;

    const bodyResult = await validateJsonBody(
      request,
      authzPermissionRequestBodySchema,
      'INVALID_AUTHZ_INPUT',
      'Invalid authz input',
    );
    if (!bodyResult.ok) return bodyResult.response;

    const result = await deps.authzService.evaluateAccess({
      userId: contextResult.context.userId,
      businessId: contextResult.context.businessId,
      role: contextResult.context.role,
      permission: bodyResult.data.permission,
    });

    return actionResultToResponse(result);
  };
}

/**
 * POST /api/authz/require
 *
 * 1. Resolve tenant context
 * 2. Validate JSON body (permission only)
 * 3. Call requirePermission with context userId/businessId/role
 */
export function createPostAuthzRequireHandler(
  deps: AuthzApiHandlerDeps,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const resolve = deps.resolveTenantContext ?? resolveTenantRequestContext;
    const contextResult = await resolve(request);
    if (!contextResult.ok) return contextResult.response;

    const bodyResult = await validateJsonBody(
      request,
      authzPermissionRequestBodySchema,
      'INVALID_AUTHZ_INPUT',
      'Invalid authz input',
    );
    if (!bodyResult.ok) return bodyResult.response;

    const result = await deps.authzService.requirePermission({
      userId: contextResult.context.userId,
      businessId: contextResult.context.businessId,
      role: contextResult.context.role,
      permission: bodyResult.data.permission,
    });

    return actionResultToResponse(result);
  };
}

/**
 * GET /api/authz/roles/:role/permissions
 *
 * 1. Resolve authenticated context
 * 2. Validate role route param
 * 3. Call listRolePermissions
 */
export function createGetRolePermissionsHandler(
  deps: AuthzApiHandlerDeps,
): (request: Request, params: unknown) => Promise<Response> {
  return async (request: Request, params: unknown): Promise<Response> => {
    const resolve =
      deps.resolveAuthenticatedContext ?? resolveAuthenticatedRequestContext;
    const contextResult = await resolve(request);
    if (!contextResult.ok) return contextResult.response;

    const paramsResult = validateRouteParams(
      params,
      rolePermissionsParamsSchema,
      'INVALID_AUTHZ_INPUT',
      'Invalid authz input',
    );
    if (!paramsResult.ok) return paramsResult.response;

    const result = await deps.authzService.listRolePermissions({
      role: paramsResult.data.role,
    });

    return actionResultToResponse(result);
  };
}

// ---------------------------------------------------------------------------
// Combined handler factory
// ---------------------------------------------------------------------------

/** Creates all authz API handlers */
export function createAuthzApiHandlers(
  deps: AuthzApiHandlerDeps,
): {
  EVALUATE: (request: Request) => Promise<Response>;
  REQUIRE: (request: Request) => Promise<Response>;
  ROLE_PERMISSIONS: (request: Request, params: unknown) => Promise<Response>;
} {
  return {
    EVALUATE: createPostAuthzEvaluateHandler(deps),
    REQUIRE: createPostAuthzRequireHandler(deps),
    ROLE_PERMISSIONS: createGetRolePermissionsHandler(deps),
  };
}
