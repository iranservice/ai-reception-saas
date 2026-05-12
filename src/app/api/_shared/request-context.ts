// ===========================================================================
// API Shared — Request Context Contract
//
// Defines typed request context contracts for anonymous, authenticated,
// tenant-scoped, and system request flows. Includes type guards, assertion
// helpers, and placeholder-safe resolver stubs.
//
// This module contains placeholder stubs only — no real auth.
// ===========================================================================

import { apiError } from './responses';
import type { AuthzPermission } from '@/domains/authz/types';
import type { MembershipRoleValue, TenantContext } from '@/domains/tenancy/types';

// ---------------------------------------------------------------------------
// Actor types
// ---------------------------------------------------------------------------

/** The type of actor making a request */
export type RequestActorType = 'anonymous' | 'user' | 'system';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

/** Base fields shared by all request contexts */
export interface BaseRequestContext {
  readonly requestId: string | null;
  readonly actorType: RequestActorType;
}

/** Context for unauthenticated/anonymous requests */
export interface AnonymousRequestContext extends BaseRequestContext {
  readonly actorType: 'anonymous';
  readonly userId: null;
  readonly businessId: null;
  readonly membershipId: null;
  readonly role: null;
}

/** Context for an authenticated user without tenant scope */
export interface AuthenticatedUserRequestContext extends BaseRequestContext {
  readonly actorType: 'user';
  readonly userId: string;
  readonly businessId: null;
  readonly membershipId: null;
  readonly role: null;
}

/** Context for an authenticated user within a tenant scope */
export interface TenantRequestContext extends BaseRequestContext {
  readonly actorType: 'user';
  readonly userId: string;
  readonly businessId: string;
  readonly membershipId: string;
  readonly role: MembershipRoleValue;
}

/** Context for system/internal requests */
export interface SystemRequestContext extends BaseRequestContext {
  readonly actorType: 'system';
  readonly userId: null;
  readonly businessId: string | null;
  readonly membershipId: null;
  readonly role: null;
}

/** Union of all possible request contexts */
export type ApiRequestContext =
  | AnonymousRequestContext
  | AuthenticatedUserRequestContext
  | TenantRequestContext
  | SystemRequestContext;

// ---------------------------------------------------------------------------
// Context result
// ---------------------------------------------------------------------------

/** Result of resolving or asserting a request context */
export type ContextResult<T> =
  | { ok: true; context: T }
  | { ok: false; response: Response };

// ---------------------------------------------------------------------------
// Context constructors
// ---------------------------------------------------------------------------

/** Creates an anonymous request context */
export function createAnonymousRequestContext(
  requestId?: string | null,
): AnonymousRequestContext {
  return {
    requestId: requestId ?? null,
    actorType: 'anonymous',
    userId: null,
    businessId: null,
    membershipId: null,
    role: null,
  };
}

/** Creates an authenticated user request context (no tenant scope) */
export function createAuthenticatedUserRequestContext(input: {
  requestId?: string | null;
  userId: string;
}): AuthenticatedUserRequestContext {
  return {
    requestId: input.requestId ?? null,
    actorType: 'user',
    userId: input.userId,
    businessId: null,
    membershipId: null,
    role: null,
  };
}

/** Creates a tenant-scoped request context from a TenantContext */
export function createTenantRequestContext(input: {
  requestId?: string | null;
  tenant: TenantContext;
}): TenantRequestContext {
  return {
    requestId: input.requestId ?? null,
    actorType: 'user',
    userId: input.tenant.userId,
    businessId: input.tenant.businessId,
    membershipId: input.tenant.membershipId,
    role: input.tenant.role,
  };
}

/** Creates a system/internal request context */
export function createSystemRequestContext(input?: {
  requestId?: string | null;
  businessId?: string | null;
}): SystemRequestContext {
  return {
    requestId: input?.requestId ?? null,
    actorType: 'system',
    userId: null,
    businessId: input?.businessId ?? null,
    membershipId: null,
    role: null,
  };
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Returns true if the context is an authenticated user or tenant context */
export function isAuthenticatedContext(
  context: ApiRequestContext,
): context is AuthenticatedUserRequestContext | TenantRequestContext {
  return context.actorType === 'user';
}

/** Returns true if the context is a tenant-scoped context */
export function isTenantContext(
  context: ApiRequestContext,
): context is TenantRequestContext {
  return context.actorType === 'user' && context.businessId !== null;
}

/** Returns true if the context is a system/internal context */
export function isSystemContext(
  context: ApiRequestContext,
): context is SystemRequestContext {
  return context.actorType === 'system';
}

/** Returns true if the context is anonymous */
export function isAnonymousContext(
  context: ApiRequestContext,
): context is AnonymousRequestContext {
  return context.actorType === 'anonymous';
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Requires that the context is an authenticated user or tenant context.
 * Returns an UNAUTHENTICATED error if not.
 */
export function requireAuthenticatedContext(
  context: ApiRequestContext,
): ContextResult<AuthenticatedUserRequestContext | TenantRequestContext> {
  if (isAuthenticatedContext(context)) {
    return { ok: true, context };
  }
  return {
    ok: false,
    response: apiError('UNAUTHENTICATED', 'Authentication required', 401),
  };
}

/**
 * Requires that the context is a tenant-scoped context.
 * Returns a TENANT_CONTEXT_REQUIRED error if not.
 */
export function requireTenantContext(
  context: ApiRequestContext,
): ContextResult<TenantRequestContext> {
  if (isTenantContext(context)) {
    return { ok: true, context };
  }
  return {
    ok: false,
    response: apiError(
      'TENANT_CONTEXT_REQUIRED',
      'Tenant context required',
      403,
    ),
  };
}

/**
 * Requires that the context is a system/internal context.
 * Returns an ACCESS_DENIED error if not.
 */
export function requireSystemContext(
  context: ApiRequestContext,
): ContextResult<SystemRequestContext> {
  if (isSystemContext(context)) {
    return { ok: true, context };
  }
  return {
    ok: false,
    response: apiError('ACCESS_DENIED', 'System context required', 403),
  };
}

// ---------------------------------------------------------------------------
// Permission contract helper
// ---------------------------------------------------------------------------

/** Packages a tenant context with a required permission for future evaluation */
export interface RequiredPermissionContext {
  readonly context: TenantRequestContext;
  readonly permission: AuthzPermission;
}

/**
 * Creates a RequiredPermissionContext.
 * Does not evaluate permissions — only packages them for future handler logic.
 */
export function createRequiredPermissionContext(
  context: TenantRequestContext,
  permission: AuthzPermission,
): RequiredPermissionContext {
  return { context, permission };
}

// ---------------------------------------------------------------------------
// Request ID utility
// ---------------------------------------------------------------------------

/** Reads the x-request-id header from a request */
export function getRequestId(request: Request): string | null {
  return request.headers.get('x-request-id');
}

// ---------------------------------------------------------------------------
// Placeholder context resolver stubs
// ---------------------------------------------------------------------------

/**
 * Resolves an anonymous request context from the request.
 * Always succeeds. Extracts requestId from x-request-id header.
 */
export async function resolveAnonymousRequestContext(
  request: Request,
): Promise<ContextResult<AnonymousRequestContext>> {
  const requestId = getRequestId(request);
  return { ok: true, context: createAnonymousRequestContext(requestId) };
}

/**
 * Placeholder stub — always returns AUTH_CONTEXT_UNAVAILABLE.
 * Will be replaced when an auth provider is integrated.
 */
export async function resolveAuthenticatedRequestContext(
  request: Request,
): Promise<ContextResult<AuthenticatedUserRequestContext>> {
  void request;
  return {
    ok: false,
    response: apiError(
      'AUTH_CONTEXT_UNAVAILABLE',
      'Authentication context is not implemented yet',
      501,
    ),
  };
}

/**
 * Placeholder stub — always returns AUTH_CONTEXT_UNAVAILABLE.
 * Will be replaced when tenant resolution is integrated.
 */
export async function resolveTenantRequestContext(
  request: Request,
): Promise<ContextResult<TenantRequestContext>> {
  void request;
  return {
    ok: false,
    response: apiError(
      'AUTH_CONTEXT_UNAVAILABLE',
      'Tenant context is not implemented yet',
      501,
    ),
  };
}

/**
 * Placeholder stub — always returns AUTH_CONTEXT_UNAVAILABLE.
 * Will be replaced when system auth is integrated.
 */
export async function resolveSystemRequestContext(
  request: Request,
): Promise<ContextResult<SystemRequestContext>> {
  void request;
  return {
    ok: false,
    response: apiError(
      'AUTH_CONTEXT_UNAVAILABLE',
      'System context is not implemented yet',
      501,
    ),
  };
}
