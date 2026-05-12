// ===========================================================================
// Identity — GET/PATCH /api/identity/me — Handler Module
//
// Handler builders for identity self-profile operations.
// Uses dependency injection for testability.
// Context resolution must succeed before any service call.
// ===========================================================================

import { actionResultToResponse } from '@/app/api/_shared/action-result';
import { validateJsonBody } from '@/app/api/_shared/request';
import {
  resolveAuthenticatedRequestContext,
  type AuthenticatedUserRequestContext,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import type { IdentityService } from '@/domains/identity/service';
import { updateUserInputSchema } from '@/domains/identity/validation';

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

/** Dependencies required by the identity/me handler module */
export interface IdentityMeHandlerDeps {
  readonly identityService: Pick<IdentityService, 'findUserById' | 'updateUser'>;
  readonly resolveContext?: (
    request: Request,
  ) => Promise<ContextResult<AuthenticatedUserRequestContext>>;
}

// ---------------------------------------------------------------------------
// Handler builders
// ---------------------------------------------------------------------------

/**
 * Creates a GET /api/identity/me handler.
 *
 * 1. Resolves authenticated request context
 * 2. Calls identityService.findUserById
 * 3. Returns the result as a Response
 *
 * Service is never called if context resolution fails.
 */
export function createGetIdentityMeHandler(
  deps: IdentityMeHandlerDeps,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const resolve = deps.resolveContext ?? resolveAuthenticatedRequestContext;
    const contextResult = await resolve(request);

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const result = await deps.identityService.findUserById({
      userId: contextResult.context.userId,
    });

    return actionResultToResponse(result);
  };
}

/**
 * Creates a PATCH /api/identity/me handler.
 *
 * 1. Resolves authenticated request context
 * 2. Validates JSON body against updateUserInputSchema
 * 3. Calls identityService.updateUser
 * 4. Returns the result as a Response
 *
 * Context resolution happens before body validation.
 * Service is never called if context or body validation fails.
 */
export function createPatchIdentityMeHandler(
  deps: IdentityMeHandlerDeps,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const resolve = deps.resolveContext ?? resolveAuthenticatedRequestContext;
    const contextResult = await resolve(request);

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const bodyResult = await validateJsonBody(
      request,
      updateUserInputSchema,
      'INVALID_IDENTITY_INPUT',
      'Invalid identity input',
    );

    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const result = await deps.identityService.updateUser(
      contextResult.context.userId,
      bodyResult.data,
    );

    return actionResultToResponse(result);
  };
}

// ---------------------------------------------------------------------------
// Combined handler factory
// ---------------------------------------------------------------------------

/** Creates both GET and PATCH handlers for /api/identity/me */
export function createIdentityMeHandlers(deps: IdentityMeHandlerDeps): {
  GET: (request: Request) => Promise<Response>;
  PATCH: (request: Request) => Promise<Response>;
} {
  return {
    GET: createGetIdentityMeHandler(deps),
    PATCH: createPatchIdentityMeHandler(deps),
  };
}
