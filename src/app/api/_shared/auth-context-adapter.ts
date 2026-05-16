// ===========================================================================
// API Shared — Auth Context Adapter
//
// Placeholder-safe authenticated request context resolver adapter using
// an explicitly enabled development/test header contract.
//
// This is NOT real authentication. This is a controlled adapter contract
// that future auth provider integrations can replace.
//
// Dev header mode is only active when ENABLE_DEV_AUTH_CONTEXT === "true".
// ===========================================================================

import { apiError } from './responses';
import {
  createAuthenticatedUserRequestContext,
  createTenantRequestContext,
  createSystemRequestContext,
  getRequestId,
  type ContextResult,
  type AuthenticatedUserRequestContext,
  type TenantRequestContext,
  type SystemRequestContext,
} from './request-context';
import type { TenantContext, MembershipRoleValue } from '@/domains/tenancy/types';
import { MEMBERSHIP_ROLE_VALUES } from '@/domains/tenancy/types';
import {
  isAuthjsRequestContextEnabled,
  createDefaultAuthjsAdapter,
} from './authjs-context-adapter';

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

/** Environment variable that controls development auth header mode */
export const DEV_AUTH_CONTEXT_FEATURE_FLAG = 'ENABLE_DEV_AUTH_CONTEXT';

/** Dev header names used by the adapter */
export const DEV_AUTH_HEADERS = {
  userId: 'x-dev-user-id',
  businessId: 'x-dev-business-id',
  membershipId: 'x-dev-membership-id',
  role: 'x-dev-role',
  system: 'x-dev-system',
} as const;

// ---------------------------------------------------------------------------
// Feature gate
// ---------------------------------------------------------------------------

/**
 * Returns true only when ENABLE_DEV_AUTH_CONTEXT is exactly "true".
 */
export function areDevAuthHeadersEnabled(
  env?: Record<string, string | undefined>,
): boolean {
  const source = env ?? process.env;
  return source[DEV_AUTH_CONTEXT_FEATURE_FLAG] === 'true';
}

// ---------------------------------------------------------------------------
// Dev principal types
// ---------------------------------------------------------------------------

/** Authenticated user principal from dev headers */
export interface DevAuthenticatedPrincipal {
  readonly userId: string;
}

/** Tenant principal from dev headers */
export interface DevTenantPrincipal {
  readonly userId: string;
  readonly businessId: string;
  readonly membershipId: string;
  readonly role: MembershipRoleValue;
}

/** System principal from dev headers */
export interface DevSystemPrincipal {
  readonly businessId: string | null;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/** Auth context adapter contract */
export interface AuthContextAdapter {
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads a header value from the request.
 * Returns null if missing, empty, or whitespace-only.
 */
export function readHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Returns an AUTH_CONTEXT_UNAVAILABLE failure result.
 */
export function authContextUnavailable(
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
export function invalidAuthContext(
  message: string,
): ContextResult<never> {
  return {
    ok: false,
    response: apiError('INVALID_AUTH_CONTEXT', message, 400),
  };
}

// ---------------------------------------------------------------------------
// Dev header principal parsers
// ---------------------------------------------------------------------------

/**
 * Parses an authenticated user principal from dev headers.
 * Requires x-dev-user-id.
 */
export function parseDevAuthenticatedPrincipal(
  request: Request,
): ContextResult<DevAuthenticatedPrincipal> {
  const userId = readHeader(request, DEV_AUTH_HEADERS.userId);
  if (!userId) {
    return authContextUnavailable(
      'Missing required dev header: x-dev-user-id',
    );
  }
  return { ok: true, context: { userId } };
}

/**
 * Parses a tenant principal from dev headers.
 * Requires x-dev-user-id, x-dev-business-id, x-dev-membership-id, x-dev-role.
 * Role must be a valid MembershipRoleValue.
 */
export function parseDevTenantPrincipal(
  request: Request,
): ContextResult<DevTenantPrincipal> {
  const userId = readHeader(request, DEV_AUTH_HEADERS.userId);
  const businessId = readHeader(request, DEV_AUTH_HEADERS.businessId);
  const membershipId = readHeader(request, DEV_AUTH_HEADERS.membershipId);
  const role = readHeader(request, DEV_AUTH_HEADERS.role);

  if (!userId || !businessId || !membershipId || !role) {
    return authContextUnavailable(
      'Missing required dev tenant headers: x-dev-user-id, x-dev-business-id, x-dev-membership-id, x-dev-role',
    );
  }

  if (!(MEMBERSHIP_ROLE_VALUES as readonly string[]).includes(role)) {
    return invalidAuthContext(
      `Invalid dev role header value: ${role}. Expected one of: ${MEMBERSHIP_ROLE_VALUES.join(', ')}`,
    );
  }

  return {
    ok: true,
    context: {
      userId,
      businessId,
      membershipId,
      role: role as MembershipRoleValue,
    },
  };
}

/**
 * Parses a system principal from dev headers.
 * Requires x-dev-system to be exactly "true".
 * x-dev-business-id is optional.
 */
export function parseDevSystemPrincipal(
  request: Request,
): ContextResult<DevSystemPrincipal> {
  const systemFlag = readHeader(request, DEV_AUTH_HEADERS.system);
  if (systemFlag !== 'true') {
    return authContextUnavailable(
      'Missing or invalid dev header: x-dev-system must be "true"',
    );
  }

  const businessId = readHeader(request, DEV_AUTH_HEADERS.businessId);
  return { ok: true, context: { businessId } };
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

/**
 * Creates a dev header auth context adapter.
 *
 * When ENABLE_DEV_AUTH_CONTEXT is not "true", all resolvers return
 * AUTH_CONTEXT_UNAVAILABLE. When enabled, resolvers read dev headers.
 */
export function createDevHeaderAuthContextAdapter(
  options?: { env?: Record<string, string | undefined> },
): AuthContextAdapter {
  return {
    async resolveAuthenticated(
      request: Request,
    ): Promise<ContextResult<AuthenticatedUserRequestContext>> {
      if (!areDevAuthHeadersEnabled(options?.env)) {
        return authContextUnavailable();
      }

      const parsed = parseDevAuthenticatedPrincipal(request);
      if (!parsed.ok) return parsed;

      return {
        ok: true,
        context: createAuthenticatedUserRequestContext({
          requestId: getRequestId(request),
          userId: parsed.context.userId,
        }),
      };
    },

    async resolveTenant(
      request: Request,
    ): Promise<ContextResult<TenantRequestContext>> {
      if (!areDevAuthHeadersEnabled(options?.env)) {
        return authContextUnavailable();
      }

      const parsed = parseDevTenantPrincipal(request);
      if (!parsed.ok) return parsed;

      const tenant: TenantContext = {
        userId: parsed.context.userId,
        businessId: parsed.context.businessId,
        membershipId: parsed.context.membershipId,
        role: parsed.context.role,
      };

      return {
        ok: true,
        context: createTenantRequestContext({
          requestId: getRequestId(request),
          tenant,
        }),
      };
    },

    async resolveSystem(
      request: Request,
    ): Promise<ContextResult<SystemRequestContext>> {
      if (!areDevAuthHeadersEnabled(options?.env)) {
        return authContextUnavailable();
      }

      const parsed = parseDevSystemPrincipal(request);
      if (!parsed.ok) return parsed;

      return {
        ok: true,
        context: createSystemRequestContext({
          requestId: getRequestId(request),
          businessId: parsed.context.businessId,
        }),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Default adapter
// ---------------------------------------------------------------------------

/**
 * Returns the default auth context adapter.
 *
 * When ENABLE_AUTHJS_REQUEST_CONTEXT is "true", returns the Auth.js
 * session-backed adapter. Otherwise returns the dev header adapter.
 *
 * TASK-0039: Added Auth.js adapter selection behind feature flag.
 */
export function getDefaultAuthContextAdapter(): AuthContextAdapter {
  if (isAuthjsRequestContextEnabled()) {
    return createDefaultAuthjsAdapter();
  }

  return createDevHeaderAuthContextAdapter();
}
