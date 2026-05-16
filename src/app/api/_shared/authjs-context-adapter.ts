// ===========================================================================
// API Shared — Auth.js Request-Context Adapter
//
// Auth.js-backed request context resolver adapter.
// Gated behind ENABLE_AUTHJS_REQUEST_CONTEXT feature flag.
//
// This adapter resolves:
// - Authenticated user context from Auth.js JWT sessions (TASK-0039)
// - Tenant context from session + x-business-id header + membership
//   lookup (TASK-0040)
// - System context remains explicitly unavailable
//
// This module does NOT import the Auth.js package directly. Session
// reading is injected via AuthjsRequestContextAdapterOptions.
//
// TASK-0039: Auth.js authenticated request-context resolver.
// TASK-0040: Auth.js tenant request-context resolver.
// ===========================================================================

import {
  createAuthenticatedUserRequestContext,
  createTenantRequestContext,
  getRequestId,
  type ContextResult,
  type AuthenticatedUserRequestContext,
  type TenantRequestContext,
  type SystemRequestContext,
} from './request-context';
import { apiError } from './responses';
import type { TenantContext } from '@/domains/tenancy/types';
import type { ActionResult } from '@/lib/result';

// ---------------------------------------------------------------------------
// Local adapter interface (matches auth-context-adapter.AuthContextAdapter)
// ---------------------------------------------------------------------------

/**
 * Auth context adapter contract.
 * Duplicated locally to avoid circular import with auth-context-adapter.
 */
export interface AuthjsAuthContextAdapter {
  resolveAuthenticated(
    request: Request,
  ): Promise<ContextResult<AuthenticatedUserRequestContext>>;
  resolveTenant(
    request: Request,
  ): Promise<ContextResult<TenantRequestContext>>;
  resolveSystem(
    request: Request,
  ): Promise<ContextResult<SystemRequestContext>>;
}

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

/** Environment variable that controls Auth.js request-context adapter */
export const AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG =
  'ENABLE_AUTHJS_REQUEST_CONTEXT' as const;

/**
 * Returns true only when ENABLE_AUTHJS_REQUEST_CONTEXT is exactly "true".
 */
export function isAuthjsRequestContextEnabled(
  env?: Record<string, string | undefined>,
): boolean {
  const source = env ?? process.env;
  return source[AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG] === 'true';
}

// ---------------------------------------------------------------------------
// Runtime prerequisite check
// ---------------------------------------------------------------------------

/**
 * Runtime feature flag name. Duplicated locally to avoid importing
 * from the auth layer feature gate module (scope guard: src/app/**
 * must not import auth library internals directly).
 */
const AUTHJS_RUNTIME_FLAG = 'ENABLE_AUTHJS_RUNTIME';

/**
 * Returns true only when ENABLE_AUTHJS_RUNTIME is exactly "true".
 * Same semantics as the auth layer's runtime enabled check.
 */
function isRuntimeEnabled(
  env?: Record<string, string | undefined>,
): boolean {
  const source = env ?? process.env;
  return source[AUTHJS_RUNTIME_FLAG] === 'true';
}

// ---------------------------------------------------------------------------
// Session types (local to avoid importing authjs-runtime at module level)
// ---------------------------------------------------------------------------

/**
 * Minimal session shape matching Auth.js JWT session.
 * Duplicated locally so this module does not trigger loading the Auth.js
 * package dependency chain at import time.
 */
export interface AuthjsSessionLike {
  readonly user?: {
    readonly id?: string | null;
    readonly email?: string | null;
    readonly name?: string | null;
    readonly image?: string | null;
  } | null;
  readonly expires?: string;
}

// ---------------------------------------------------------------------------
// Session reader type
// ---------------------------------------------------------------------------

/**
 * Function that reads an Auth.js session from a request.
 * Must be called with the incoming Request so Auth.js can read cookies.
 */
export type AuthjsSessionReader = (
  request: Request,
) => Promise<AuthjsSessionLike | null>;

// ---------------------------------------------------------------------------
// Tenant membership resolver type
// ---------------------------------------------------------------------------

/**
 * Input for tenant membership resolution.
 */
export interface ResolveTenantInput {
  readonly userId: string;
  readonly businessId: string;
}

/**
 * Function that resolves a tenant context from userId + businessId.
 * Returns an ActionResult wrapping TenantContext on success,
 * or an error if the user has no active membership in the business.
 */
export type TenantMembershipResolver = (
  input: ResolveTenantInput,
) => Promise<ActionResult<TenantContext>>;

// ---------------------------------------------------------------------------
// Adapter options
// ---------------------------------------------------------------------------

/**
 * Options for the Auth.js request-context adapter factory.
 */
export interface AuthjsRequestContextAdapterOptions {
  /** Auth.js session reader — receives the Request, returns session or null */
  auth: AuthjsSessionReader;
  /** Tenant membership resolver — resolves userId+businessId to TenantContext */
  tenantMembershipResolver: TenantMembershipResolver;
  /** Environment override for testing (defaults to process.env) */
  env?: Record<string, string | undefined>;
}

// ---------------------------------------------------------------------------
// Local helpers (avoid importing from auth-context-adapter to prevent circular)
// ---------------------------------------------------------------------------

/**
 * Returns an AUTH_CONTEXT_UNAVAILABLE failure result.
 */
function unavailable(
  message?: string,
): ContextResult<never> {
  return {
    ok: false,
    response: apiError(
      'AUTH_CONTEXT_UNAVAILABLE',
      message ?? 'Authentication context is not implemented yet',
      501,
    ),
  };
}

/**
 * Returns an INVALID_AUTH_CONTEXT failure result.
 */
function invalidAuth(
  message: string,
): ContextResult<never> {
  return {
    ok: false,
    response: apiError('INVALID_AUTH_CONTEXT', message, 400),
  };
}

// ---------------------------------------------------------------------------
// Business scope header
// ---------------------------------------------------------------------------

/** Header name for explicit business scope */
export const BUSINESS_SCOPE_HEADER = 'x-business-id';

// ---------------------------------------------------------------------------
// Error messages
// ---------------------------------------------------------------------------

export const AUTHJS_REQUEST_CONTEXT_NOT_ENABLED_MESSAGE =
  'ENABLE_AUTHJS_REQUEST_CONTEXT is not enabled.';

export const AUTHJS_RUNTIME_NOT_ENABLED_MESSAGE =
  'Auth.js runtime is not enabled. ENABLE_AUTHJS_REQUEST_CONTEXT requires ENABLE_AUTHJS_RUNTIME to also be enabled.';

export const AUTHJS_SESSION_READ_FAILED_MESSAGE =
  'Session read failed';

export const AUTHJS_SESSION_MISSING_USER_ID_MESSAGE =
  'Auth.js session exists but is missing internal user ID (session.user.id). ' +
  'Ensure the Auth.js jwt and session callbacks are configured to include user.id.';

export const AUTHJS_TENANT_CONTEXT_REQUIRED_MESSAGE =
  'Tenant context required. Provide x-business-id header.';

export const AUTHJS_TENANT_INVALID_BUSINESS_ID_MESSAGE =
  'x-business-id header is empty or whitespace-only.';

export const AUTHJS_TENANT_ACCESS_DENIED_MESSAGE =
  'User does not have an active membership in the specified business.';

export const AUTHJS_TENANT_RESOLVER_FAILED_MESSAGE =
  'Tenant membership resolution failed.';

export const AUTHJS_SYSTEM_CONTEXT_UNAVAILABLE_MESSAGE =
  'System context resolution is not available in the Auth.js adapter. Deferred to a future task.';

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

/**
 * Creates an Auth.js-backed request-context adapter.
 *
 * - `resolveAuthenticated`: uses Auth.js session to extract user ID
 * - `resolveTenant`: uses Auth.js session + x-business-id header +
 *   membership lookup
 * - `resolveSystem`: always returns AUTH_CONTEXT_UNAVAILABLE (deferred)
 *
 * @param options - Adapter configuration with injected auth and resolver
 */
export function createAuthjsRequestContextAdapter(
  options: AuthjsRequestContextAdapterOptions,
): AuthjsAuthContextAdapter {
  const { auth, tenantMembershipResolver, env } = options;

  return {
    async resolveAuthenticated(
      request: Request,
    ): Promise<ContextResult<AuthenticatedUserRequestContext>> {
      // Gate 1: ENABLE_AUTHJS_REQUEST_CONTEXT must be enabled
      if (!isAuthjsRequestContextEnabled(env)) {
        return unavailable(AUTHJS_REQUEST_CONTEXT_NOT_ENABLED_MESSAGE);
      }

      // Gate 2: Auth.js runtime must be enabled
      if (!isRuntimeEnabled(env)) {
        return unavailable(AUTHJS_RUNTIME_NOT_ENABLED_MESSAGE);
      }

      // Read session from request cookies via Auth.js auth()
      // Infrastructure errors (runtime init, auth missing, auth throws)
      // are surfaced as AUTH_CONTEXT_UNAVAILABLE 501 — the session layer
      // is unavailable, not the caller's fault.
      let session: AuthjsSessionLike | null;
      try {
        session = await auth(request);
      } catch {
        return unavailable(AUTHJS_SESSION_READ_FAILED_MESSAGE);
      }

      // No session → unauthenticated
      if (!session || !session.user) {
        return {
          ok: false,
          response: apiError(
            'UNAUTHENTICATED',
            'Authentication required',
            401,
          ),
        };
      }

      // Session exists but user.id is missing, null, or empty
      const userId = session.user.id;
      const trimmedId = typeof userId === 'string' ? userId.trim() : '';
      if (trimmedId.length === 0) {
        return invalidAuth(AUTHJS_SESSION_MISSING_USER_ID_MESSAGE);
      }

      // Success — return authenticated context with trimmed userId
      return {
        ok: true,
        context: createAuthenticatedUserRequestContext({
          requestId: getRequestId(request),
          userId: trimmedId,
        }),
      };
    },

    async resolveTenant(
      request: Request,
    ): Promise<ContextResult<TenantRequestContext>> {
      // Step 1: Resolve authenticated context first
      const authResult = await this.resolveAuthenticated(request);
      if (!authResult.ok) {
        return authResult;
      }

      const { userId } = authResult.context;

      // Step 2: Extract businessId from x-business-id header
      const rawBusinessId = request.headers.get(BUSINESS_SCOPE_HEADER);
      if (rawBusinessId === null) {
        return {
          ok: false,
          response: apiError(
            'TENANT_CONTEXT_REQUIRED',
            AUTHJS_TENANT_CONTEXT_REQUIRED_MESSAGE,
            403,
          ),
        };
      }

      const businessId = rawBusinessId.trim();
      if (businessId.length === 0) {
        return invalidAuth(AUTHJS_TENANT_INVALID_BUSINESS_ID_MESSAGE);
      }

      // Step 3: Resolve tenant membership
      let resolveResult: ActionResult<TenantContext>;
      try {
        resolveResult = await tenantMembershipResolver({
          userId,
          businessId,
        });
      } catch {
        return unavailable(AUTHJS_TENANT_RESOLVER_FAILED_MESSAGE);
      }

      if (!resolveResult.ok) {
        return {
          ok: false,
          response: apiError(
            'ACCESS_DENIED',
            AUTHJS_TENANT_ACCESS_DENIED_MESSAGE,
            403,
          ),
        };
      }

      // Step 4: Return tenant context
      return {
        ok: true,
        context: createTenantRequestContext({
          requestId: getRequestId(request),
          tenant: resolveResult.data,
        }),
      };
    },

    async resolveSystem(
      _request: Request,
    ): Promise<ContextResult<SystemRequestContext>> {
      return unavailable(AUTHJS_SYSTEM_CONTEXT_UNAVAILABLE_MESSAGE);
    },
  };
}

// ---------------------------------------------------------------------------
// Default Auth.js adapter factory (wired with shared runtime)
// ---------------------------------------------------------------------------

/**
 * Creates the default Auth.js request-context adapter wired to the
 * shared lazy runtime's readAuthjsSession function and the
 * TenancyService's resolveTenantContext for membership lookup.
 *
 * Uses lazy wrappers to avoid importing heavy modules at module
 * load time. The imports happen only when the functions are called.
 *
 * Called by `getDefaultAuthContextAdapter()` when the Auth.js
 * request-context feature flag is enabled.
 */
export function createDefaultAuthjsAdapter(): AuthjsAuthContextAdapter {
  const lazySessionReader: AuthjsSessionReader = async (request: Request) => {
    const { readAuthjsSession } = await import('@/lib/auth/authjs-runtime');
    return readAuthjsSession(request);
  };

  const lazyTenantResolver: TenantMembershipResolver = async (input) => {
    const { getApiDependencies } = await import('./composition');
    const tenancyService = getApiDependencies().services.tenancy;
    return tenancyService.resolveTenantContext(input);
  };

  return createAuthjsRequestContextAdapter({
    auth: lazySessionReader,
    tenantMembershipResolver: lazyTenantResolver,
  });
}
