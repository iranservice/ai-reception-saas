// ===========================================================================
// API Shared — Auth.js Request-Context Adapter
//
// Auth.js-backed authenticated request context resolver adapter.
// Gated behind ENABLE_AUTHJS_REQUEST_CONTEXT feature flag.
//
// This adapter resolves ONLY authenticated user context from Auth.js
// JWT sessions. Tenant and system context resolution remain explicitly
// unavailable and deferred to future tasks.
//
// This module does NOT import the Auth.js package directly. Session
// reading is injected via AuthjsRequestContextAdapterOptions.
//
// TASK-0039: Auth.js authenticated request-context resolver.
// ===========================================================================

import {
  createAuthenticatedUserRequestContext,
  getRequestId,
  type ContextResult,
  type AuthenticatedUserRequestContext,
  type TenantRequestContext,
  type SystemRequestContext,
} from './request-context';
import { apiError } from './responses';

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
// Adapter options
// ---------------------------------------------------------------------------

/**
 * Options for the Auth.js request-context adapter factory.
 */
export interface AuthjsRequestContextAdapterOptions {
  /** Auth.js session reader — receives the Request, returns session or null */
  auth: AuthjsSessionReader;
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

export const AUTHJS_TENANT_CONTEXT_UNAVAILABLE_MESSAGE =
  'Tenant context resolution is not available in the Auth.js adapter. Deferred to a future task.';

export const AUTHJS_SYSTEM_CONTEXT_UNAVAILABLE_MESSAGE =
  'System context resolution is not available in the Auth.js adapter. Deferred to a future task.';

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

/**
 * Creates an Auth.js-backed request-context adapter.
 *
 * - `resolveAuthenticated`: uses Auth.js session to extract user ID
 * - `resolveTenant`: always returns AUTH_CONTEXT_UNAVAILABLE (deferred)
 * - `resolveSystem`: always returns AUTH_CONTEXT_UNAVAILABLE (deferred)
 *
 * @param options - Adapter configuration with injected auth function
 */
export function createAuthjsRequestContextAdapter(
  options: AuthjsRequestContextAdapterOptions,
): AuthjsAuthContextAdapter {
  const { auth, env } = options;

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
      // Catch thrown errors — fail to UNAUTHENTICATED, not 500
      let session: AuthjsSessionLike | null;
      try {
        session = await auth(request);
      } catch {
        return {
          ok: false,
          response: apiError(
            'UNAUTHENTICATED',
            AUTHJS_SESSION_READ_FAILED_MESSAGE,
            401,
          ),
        };
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
      _request: Request,
    ): Promise<ContextResult<TenantRequestContext>> {
      return unavailable(AUTHJS_TENANT_CONTEXT_UNAVAILABLE_MESSAGE);
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
 * shared lazy runtime's readAuthjsSession function.
 *
 * Uses a lazy wrapper around readAuthjsSession to avoid importing
 * authjs-runtime (and its Auth.js package transitive dependency) at
 * module load time. The import happens only when auth is called.
 *
 * Called by `getDefaultAuthContextAdapter()` when the Auth.js
 * request-context feature flag is enabled.
 */
export function createDefaultAuthjsAdapter(): AuthjsAuthContextAdapter {
  const lazySessionReader: AuthjsSessionReader = async (request: Request) => {
    const { readAuthjsSession } = await import('@/lib/auth/authjs-runtime');
    return readAuthjsSession(request);
  };
  return createAuthjsRequestContextAdapter({ auth: lazySessionReader });
}
