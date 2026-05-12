// ===========================================================================
// Tests — API Request Context Contract
//
// Verifies context types, constructors, type guards, assertion helpers,
// placeholder resolver stubs, error mappings, and scope guards.
// No server startup, DB, or auth required.
// ===========================================================================

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  createAnonymousRequestContext,
  createAuthenticatedUserRequestContext,
  createTenantRequestContext,
  createSystemRequestContext,
  isAnonymousContext,
  isAuthenticatedContext,
  isTenantContext,
  isSystemContext,
  requireAuthenticatedContext,
  requireTenantContext,
  requireSystemContext,
  createRequiredPermissionContext,
  getRequestId,
  resolveAnonymousRequestContext,
  resolveAuthenticatedRequestContext,
  resolveTenantRequestContext,
  resolveSystemRequestContext,
} from '@/app/api/_shared/request-context';

import { getHttpStatusForError } from '@/app/api/_shared/errors';

// ---------------------------------------------------------------------------
// 1. Constructors
// ---------------------------------------------------------------------------

describe('Context constructors', () => {
  it('createAnonymousRequestContext creates anonymous context with null fields', () => {
    const ctx = createAnonymousRequestContext('req-1');
    expect(ctx.actorType).toBe('anonymous');
    expect(ctx.requestId).toBe('req-1');
    expect(ctx.userId).toBeNull();
    expect(ctx.businessId).toBeNull();
    expect(ctx.membershipId).toBeNull();
    expect(ctx.role).toBeNull();
  });

  it('createAnonymousRequestContext defaults requestId to null', () => {
    const ctx = createAnonymousRequestContext();
    expect(ctx.requestId).toBeNull();
  });

  it('createAuthenticatedUserRequestContext creates user context', () => {
    const ctx = createAuthenticatedUserRequestContext({
      requestId: 'req-2',
      userId: 'user-123',
    });
    expect(ctx.actorType).toBe('user');
    expect(ctx.requestId).toBe('req-2');
    expect(ctx.userId).toBe('user-123');
    expect(ctx.businessId).toBeNull();
    expect(ctx.membershipId).toBeNull();
    expect(ctx.role).toBeNull();
  });

  it('createTenantRequestContext maps TenantContext correctly', () => {
    const ctx = createTenantRequestContext({
      requestId: 'req-3',
      tenant: {
        userId: 'user-456',
        businessId: 'biz-789',
        membershipId: 'mem-012',
        role: 'OWNER',
      },
    });
    expect(ctx.actorType).toBe('user');
    expect(ctx.requestId).toBe('req-3');
    expect(ctx.userId).toBe('user-456');
    expect(ctx.businessId).toBe('biz-789');
    expect(ctx.membershipId).toBe('mem-012');
    expect(ctx.role).toBe('OWNER');
  });

  it('createSystemRequestContext creates system context with optional businessId', () => {
    const ctx1 = createSystemRequestContext();
    expect(ctx1.actorType).toBe('system');
    expect(ctx1.userId).toBeNull();
    expect(ctx1.businessId).toBeNull();
    expect(ctx1.membershipId).toBeNull();
    expect(ctx1.role).toBeNull();

    const ctx2 = createSystemRequestContext({ businessId: 'biz-sys' });
    expect(ctx2.businessId).toBe('biz-sys');
  });
});

// ---------------------------------------------------------------------------
// 2. Type guards
// ---------------------------------------------------------------------------

describe('Type guards', () => {
  const anonymous = createAnonymousRequestContext();
  const user = createAuthenticatedUserRequestContext({ userId: 'u1' });
  const tenant = createTenantRequestContext({
    tenant: {
      userId: 'u2',
      businessId: 'b1',
      membershipId: 'm1',
      role: 'ADMIN',
    },
  });
  const system = createSystemRequestContext();

  it('isAnonymousContext returns true only for anonymous', () => {
    expect(isAnonymousContext(anonymous)).toBe(true);
    expect(isAnonymousContext(user)).toBe(false);
    expect(isAnonymousContext(tenant)).toBe(false);
    expect(isAnonymousContext(system)).toBe(false);
  });

  it('isAuthenticatedContext returns true for authenticated user and tenant contexts', () => {
    expect(isAuthenticatedContext(anonymous)).toBe(false);
    expect(isAuthenticatedContext(user)).toBe(true);
    expect(isAuthenticatedContext(tenant)).toBe(true);
    expect(isAuthenticatedContext(system)).toBe(false);
  });

  it('isTenantContext returns true only for tenant context', () => {
    expect(isTenantContext(anonymous)).toBe(false);
    expect(isTenantContext(user)).toBe(false);
    expect(isTenantContext(tenant)).toBe(true);
    expect(isTenantContext(system)).toBe(false);
  });

  it('isSystemContext returns true only for system context', () => {
    expect(isSystemContext(anonymous)).toBe(false);
    expect(isSystemContext(user)).toBe(false);
    expect(isSystemContext(tenant)).toBe(false);
    expect(isSystemContext(system)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Assertion helpers
// ---------------------------------------------------------------------------

describe('Assertion helpers', () => {
  const anonymous = createAnonymousRequestContext();
  const user = createAuthenticatedUserRequestContext({ userId: 'u1' });
  const tenant = createTenantRequestContext({
    tenant: {
      userId: 'u2',
      businessId: 'b1',
      membershipId: 'm1',
      role: 'OWNER',
    },
  });
  const system = createSystemRequestContext();

  it('requireAuthenticatedContext accepts authenticated user context', () => {
    const result = requireAuthenticatedContext(user);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.userId).toBe('u1');
    }
  });

  it('requireAuthenticatedContext accepts tenant context', () => {
    const result = requireAuthenticatedContext(tenant);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.userId).toBe('u2');
    }
  });

  it('requireAuthenticatedContext rejects anonymous with UNAUTHENTICATED 401', async () => {
    const result = requireAuthenticatedContext(anonymous);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('requireTenantContext accepts tenant context', () => {
    const result = requireTenantContext(tenant);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.businessId).toBe('b1');
    }
  });

  it('requireTenantContext rejects authenticated user context with TENANT_CONTEXT_REQUIRED 403', async () => {
    const result = requireTenantContext(user);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error.code).toBe('TENANT_CONTEXT_REQUIRED');
    }
  });

  it('requireSystemContext accepts system context', () => {
    const result = requireSystemContext(system);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('system');
    }
  });

  it('requireSystemContext rejects user context with ACCESS_DENIED 403', async () => {
    const result = requireSystemContext(user);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error.code).toBe('ACCESS_DENIED');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Permission contract helper
// ---------------------------------------------------------------------------

describe('Permission contract helper', () => {
  it('createRequiredPermissionContext packages tenant context + permission', () => {
    const tenant = createTenantRequestContext({
      tenant: {
        userId: 'u1',
        businessId: 'b1',
        membershipId: 'm1',
        role: 'ADMIN',
      },
    });
    const perm = createRequiredPermissionContext(tenant, 'business.read');
    expect(perm.context).toBe(tenant);
    expect(perm.permission).toBe('business.read');
  });
});

// ---------------------------------------------------------------------------
// 5. Resolver stubs
// ---------------------------------------------------------------------------

describe('Resolver stubs', () => {
  it('getRequestId reads x-request-id', () => {
    const req = new Request('http://localhost/test', {
      headers: { 'x-request-id': 'abc-123' },
    });
    expect(getRequestId(req)).toBe('abc-123');

    const reqNoId = new Request('http://localhost/test');
    expect(getRequestId(reqNoId)).toBeNull();
  });

  it('resolveAnonymousRequestContext returns anonymous context and requestId', async () => {
    const req = new Request('http://localhost/test', {
      headers: { 'x-request-id': 'req-anon' },
    });
    const result = await resolveAnonymousRequestContext(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('anonymous');
      expect(result.context.requestId).toBe('req-anon');
    }
  });

  it('resolveAuthenticatedRequestContext returns AUTH_CONTEXT_UNAVAILABLE 501', async () => {
    const req = new Request('http://localhost/test');
    const result = await resolveAuthenticatedRequestContext(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
  });

  it('resolveTenantRequestContext returns AUTH_CONTEXT_UNAVAILABLE 501', async () => {
    const req = new Request('http://localhost/test');
    const result = await resolveTenantRequestContext(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
  });

  it('resolveSystemRequestContext returns AUTH_CONTEXT_UNAVAILABLE 501', async () => {
    const req = new Request('http://localhost/test');
    const result = await resolveSystemRequestContext(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Error map
// ---------------------------------------------------------------------------

describe('Error map entries', () => {
  it('getHttpStatusForError AUTH_CONTEXT_UNAVAILABLE returns 501', () => {
    expect(getHttpStatusForError('AUTH_CONTEXT_UNAVAILABLE')).toBe(501);
  });

  it('getHttpStatusForError TENANT_CONTEXT_REQUIRED returns 403', () => {
    expect(getHttpStatusForError('TENANT_CONTEXT_REQUIRED')).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 7. Scope guard
// ---------------------------------------------------------------------------

describe('Scope guard', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '../..');
  const FILE_PATH = path.join(
    PROJECT_ROOT,
    'src/app/api/_shared/request-context.ts',
  );

  const FORBIDDEN = [
    'getApiDependencies',
    'getPrisma',
    'PrismaClient',
    "from '@/domains/identity",
    "from '@/domains/tenancy/service",
    "from '@/domains/tenancy/repository",
    "from '@/domains/authz/service",
    'repository',
    'implementation',
    'middleware',
    'clerk',
    'next-auth',
    'supabase',
  ];

  it('request-context.ts must not contain forbidden imports', () => {
    const content = fs.readFileSync(FILE_PATH, 'utf-8');
    for (const forbidden of FORBIDDEN) {
      expect(content).not.toContain(forbidden);
    }
  });
});
