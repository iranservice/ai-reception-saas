// ===========================================================================
// Identity — Session API Handler Module
//
// Handler builders for identity session operations.
// Uses dependency injection for testability.
// Context resolution must succeed before any service call.
// ===========================================================================

import { actionResultToResponse } from '@/app/api/_shared/action-result';
import { validateJsonBody } from '@/app/api/_shared/request';
import {
  validateRouteParams,
  parseBooleanQueryParam,
  getSearchParam,
  uuidParamSchema,
} from '@/app/api/_shared/params';
import {
  resolveAuthenticatedRequestContext,
  type AuthenticatedUserRequestContext,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import { apiError } from '@/app/api/_shared/responses';
import type { IdentityService } from '@/domains/identity/service';
import { createSessionInputSchema } from '@/domains/identity/validation';

// ---------------------------------------------------------------------------
// Local schemas
// ---------------------------------------------------------------------------

/**
 * Request body schema for POST /api/identity/sessions.
 * userId is omitted — it must come from the authenticated context.
 */
const createSessionRequestBodySchema = createSessionInputSchema
  .omit({ userId: true })
  .strict();

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

/** Dependencies required by the identity sessions handler module */
export interface IdentitySessionsHandlerDeps {
  readonly identityService: Pick<
    IdentityService,
    'createSession' | 'listUserSessions' | 'findSessionById' | 'revokeSession'
  >;
  readonly resolveContext?: (
    request: Request,
  ) => Promise<ContextResult<AuthenticatedUserRequestContext>>;
  readonly now?: () => Date;
}

// ---------------------------------------------------------------------------
// Handler builders
// ---------------------------------------------------------------------------

/**
 * Creates a POST /api/identity/sessions handler.
 *
 * 1. Resolves authenticated request context
 * 2. Validates JSON body (userId excluded — comes from context)
 * 3. Calls identityService.createSession
 * 4. Returns the result as a Response
 */
export function createPostIdentitySessionsHandler(
  deps: IdentitySessionsHandlerDeps,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const resolve = deps.resolveContext ?? resolveAuthenticatedRequestContext;
    const contextResult = await resolve(request);

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const bodyResult = await validateJsonBody(
      request,
      createSessionRequestBodySchema,
      'INVALID_IDENTITY_INPUT',
      'Invalid identity input',
    );

    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const result = await deps.identityService.createSession({
      ...bodyResult.data,
      userId: contextResult.context.userId,
    });

    return actionResultToResponse(result);
  };
}

/**
 * Creates a GET /api/identity/sessions handler.
 *
 * 1. Resolves authenticated request context
 * 2. Reads includeRevoked query param
 * 3. Calls identityService.listUserSessions
 * 4. Returns the result as a Response
 */
export function createGetIdentitySessionsHandler(
  deps: IdentitySessionsHandlerDeps,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const resolve = deps.resolveContext ?? resolveAuthenticatedRequestContext;
    const contextResult = await resolve(request);

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const includeRevoked = parseBooleanQueryParam(
      getSearchParam(request, 'includeRevoked'),
    );

    const result = await deps.identityService.listUserSessions({
      userId: contextResult.context.userId,
      includeRevoked: includeRevoked ?? false,
    });

    return actionResultToResponse(result);
  };
}

/**
 * Creates a POST /api/identity/sessions/:sessionId/revoke handler.
 *
 * 1. Resolves authenticated request context
 * 2. Validates sessionId route param
 * 3. Finds session by ID
 * 4. Checks session ownership (session.userId === context.userId)
 * 5. Calls identityService.revokeSession
 * 6. Returns the result as a Response
 *
 * Ownership check must pass before revokeSession is called.
 */
export function createPostRevokeIdentitySessionHandler(
  deps: IdentitySessionsHandlerDeps,
): (request: Request, params: unknown) => Promise<Response> {
  return async (request: Request, params: unknown): Promise<Response> => {
    const resolve = deps.resolveContext ?? resolveAuthenticatedRequestContext;
    const contextResult = await resolve(request);

    if (!contextResult.ok) {
      return contextResult.response;
    }

    const paramsResult = validateRouteParams(
      params,
      uuidParamSchema('sessionId'),
      'INVALID_IDENTITY_INPUT',
      'Invalid identity input',
    );

    if (!paramsResult.ok) {
      return paramsResult.response;
    }

    const { sessionId } = paramsResult.data;

    const findResult = await deps.identityService.findSessionById({
      sessionId,
    });

    if (!findResult.ok) {
      return actionResultToResponse(findResult);
    }

    if (findResult.data === null) {
      return apiError('SESSION_NOT_FOUND', 'Session not found', 404);
    }

    if (findResult.data.userId !== contextResult.context.userId) {
      return apiError('ACCESS_DENIED', 'Access denied', 403);
    }

    const nowFn = deps.now ?? (() => new Date());

    const result = await deps.identityService.revokeSession({
      sessionId,
      revokedAt: nowFn().toISOString(),
    });

    return actionResultToResponse(result);
  };
}

// ---------------------------------------------------------------------------
// Combined handler factory
// ---------------------------------------------------------------------------

/** Creates POST, GET, and REVOKE handlers for identity sessions */
export function createIdentitySessionHandlers(
  deps: IdentitySessionsHandlerDeps,
): {
  POST: (request: Request) => Promise<Response>;
  GET: (request: Request) => Promise<Response>;
  REVOKE: (request: Request, params: unknown) => Promise<Response>;
} {
  return {
    POST: createPostIdentitySessionsHandler(deps),
    GET: createGetIdentitySessionsHandler(deps),
    REVOKE: createPostRevokeIdentitySessionHandler(deps),
  };
}
