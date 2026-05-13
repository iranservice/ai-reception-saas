import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createPostAuthzEvaluateHandler,
  createPostAuthzRequireHandler,
  createGetRolePermissionsHandler,
  createAuthzApiHandlers,
} from '@/app/api/authz/handler';
import {
  createTenantRequestContext,
  createAuthenticatedUserRequestContext,
  type TenantRequestContext,
  type AuthenticatedUserRequestContext,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import { apiError } from '@/app/api/_shared/responses';
import { makeJsonRequest } from '@/app/api/_shared/request';
import { ok, err } from '@/lib/result';
import { API_HANDLERS_FEATURE_FLAG } from '@/app/api/_shared/feature-gate';
import {
  DEV_AUTH_CONTEXT_FEATURE_FLAG,
  DEV_AUTH_HEADERS,
} from '@/app/api/_shared/auth-context-adapter';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BIZ_ID = '44444444-4444-4444-8444-444444444444';
const MEM_ID = '66666666-6666-4666-8666-666666666666';

vi.mock('@/app/api/_shared/composition', () => ({
  getApiDependencies: () => ({
    services: {
      authz: {
        evaluateAccess: vi.fn().mockResolvedValue(ok({ allowed: true })),
        requirePermission: vi.fn().mockResolvedValue(ok({ allowed: true })),
        listRolePermissions: vi
          .fn()
          .mockResolvedValue(ok(['business.read', 'members.read'])),
      },
    },
  }),
}));

function mockSvc() {
  return {
    authzService: {
      evaluateAccess: vi.fn(),
      requirePermission: vi.fn(),
      listRolePermissions: vi.fn(),
    },
  };
}

function okTenant(): (
  r: Request,
) => Promise<ContextResult<TenantRequestContext>> {
  return async () => ({
    ok: true as const,
    context: createTenantRequestContext({
      requestId: null,
      tenant: {
        userId: USER_ID,
        businessId: BIZ_ID,
        membershipId: MEM_ID,
        role: 'OWNER',
      },
    }),
  });
}

function okAuth(): (
  r: Request,
) => Promise<ContextResult<AuthenticatedUserRequestContext>> {
  return async () => ({
    ok: true as const,
    context: createAuthenticatedUserRequestContext({
      requestId: null,
      userId: USER_ID,
    }),
  });
}

function failCtx<T>(): (r: Request) => Promise<ContextResult<T>> {
  return async () => ({
    ok: false as const,
    response: apiError(
      'AUTH_CONTEXT_UNAVAILABLE',
      'Auth unavailable',
      501,
    ),
  });
}

let pA: string | undefined, pD: string | undefined;
beforeEach(() => {
  pA = process.env[API_HANDLERS_FEATURE_FLAG];
  pD = process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
  delete process.env[API_HANDLERS_FEATURE_FLAG];
  delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
});
afterEach(() => {
  if (pA !== undefined) process.env[API_HANDLERS_FEATURE_FLAG] = pA;
  else delete process.env[API_HANDLERS_FEATURE_FLAG];
  if (pD !== undefined) process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = pD;
  else delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
});

const devTenantHeaders: Record<string, string> = {
  [DEV_AUTH_HEADERS.userId]: USER_ID,
  [DEV_AUTH_HEADERS.businessId]: BIZ_ID,
  [DEV_AUTH_HEADERS.membershipId]: MEM_ID,
  [DEV_AUTH_HEADERS.role]: 'OWNER',
};

// ---------------------------------------------------------------------------
// Evaluate handler
// ---------------------------------------------------------------------------

describe('Evaluate handler', () => {
  it('returns 501 when context fails', async () => {
    const s = mockSvc();
    const h = createPostAuthzEvaluateHandler({
      ...s,
      resolveTenantContext: failCtx(),
    });
    const r = await h(makeJsonRequest({ permission: 'business.read' }));
    expect(r.status).toBe(501);
    expect(s.authzService.evaluateAccess).not.toHaveBeenCalled();
  });

  it('rejects invalid body', async () => {
    const s = mockSvc();
    const h = createPostAuthzEvaluateHandler({
      ...s,
      resolveTenantContext: okTenant(),
    });
    const r = await h(makeJsonRequest({ permission: 'invalid.permission' }));
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('INVALID_AUTHZ_INPUT');
    expect(s.authzService.evaluateAccess).not.toHaveBeenCalled();
  });

  it('rejects missing body', async () => {
    const s = mockSvc();
    const h = createPostAuthzEvaluateHandler({
      ...s,
      resolveTenantContext: okTenant(),
    });
    const r = await h(makeJsonRequest({}));
    expect(r.status).toBe(400);
  });

  it('uses context userId/businessId/role not body values', async () => {
    const s = mockSvc();
    s.authzService.evaluateAccess.mockResolvedValue(ok({ allowed: true }));
    const h = createPostAuthzEvaluateHandler({
      ...s,
      resolveTenantContext: okTenant(),
    });
    const r = await h(makeJsonRequest({ permission: 'business.read' }));
    expect(r.status).toBe(200);
    expect(s.authzService.evaluateAccess).toHaveBeenCalledWith({
      userId: USER_ID,
      businessId: BIZ_ID,
      role: 'OWNER',
      permission: 'business.read',
    });
  });

  it('passes service error through', async () => {
    const s = mockSvc();
    s.authzService.evaluateAccess.mockResolvedValue(
      err('INVALID_AUTHZ_INPUT', 'bad'),
    );
    const h = createPostAuthzEvaluateHandler({
      ...s,
      resolveTenantContext: okTenant(),
    });
    const r = await h(makeJsonRequest({ permission: 'business.read' }));
    expect(r.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Require handler
// ---------------------------------------------------------------------------

describe('Require handler', () => {
  it('returns 501 when context fails', async () => {
    const s = mockSvc();
    const h = createPostAuthzRequireHandler({
      ...s,
      resolveTenantContext: failCtx(),
    });
    const r = await h(makeJsonRequest({ permission: 'business.read' }));
    expect(r.status).toBe(501);
    expect(s.authzService.requirePermission).not.toHaveBeenCalled();
  });

  it('rejects invalid body', async () => {
    const s = mockSvc();
    const h = createPostAuthzRequireHandler({
      ...s,
      resolveTenantContext: okTenant(),
    });
    const r = await h(makeJsonRequest({ permission: 'nope' }));
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('INVALID_AUTHZ_INPUT');
  });

  it('calls requirePermission with context values', async () => {
    const s = mockSvc();
    s.authzService.requirePermission.mockResolvedValue(
      ok({ allowed: true }),
    );
    const h = createPostAuthzRequireHandler({
      ...s,
      resolveTenantContext: okTenant(),
    });
    const r = await h(makeJsonRequest({ permission: 'members.read' }));
    expect(r.status).toBe(200);
    expect(s.authzService.requirePermission).toHaveBeenCalledWith({
      userId: USER_ID,
      businessId: BIZ_ID,
      role: 'OWNER',
      permission: 'members.read',
    });
  });

  it('returns denied decision from service as-is', async () => {
    const s = mockSvc();
    s.authzService.requirePermission.mockResolvedValue(
      ok({ allowed: false, reason: 'Denied' }),
    );
    const h = createPostAuthzRequireHandler({
      ...s,
      resolveTenantContext: okTenant(),
    });
    const r = await h(makeJsonRequest({ permission: 'business.read' }));
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.data.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Role permissions handler
// ---------------------------------------------------------------------------

describe('Role permissions handler', () => {
  it('returns 501 when authenticated context fails', async () => {
    const s = mockSvc();
    const h = createGetRolePermissionsHandler({
      ...s,
      resolveAuthenticatedContext: failCtx(),
    });
    const r = await h(new Request('http://x'), { role: 'OWNER' });
    expect(r.status).toBe(501);
    expect(s.authzService.listRolePermissions).not.toHaveBeenCalled();
  });

  it('rejects invalid role param', async () => {
    const s = mockSvc();
    const h = createGetRolePermissionsHandler({
      ...s,
      resolveAuthenticatedContext: okAuth(),
    });
    const r = await h(new Request('http://x'), { role: 'INVALID_ROLE' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('INVALID_AUTHZ_INPUT');
  });

  it('calls listRolePermissions with valid role', async () => {
    const s = mockSvc();
    s.authzService.listRolePermissions.mockResolvedValue(
      ok(['business.read']),
    );
    const h = createGetRolePermissionsHandler({
      ...s,
      resolveAuthenticatedContext: okAuth(),
    });
    const r = await h(new Request('http://x'), { role: 'OWNER' });
    expect(r.status).toBe(200);
    expect(s.authzService.listRolePermissions).toHaveBeenCalledWith({
      role: 'OWNER',
    });
  });

  it('passes service error through', async () => {
    const s = mockSvc();
    s.authzService.listRolePermissions.mockResolvedValue(
      err('INTERNAL_SERVER_ERROR', 'fail'),
    );
    const h = createGetRolePermissionsHandler({
      ...s,
      resolveAuthenticatedContext: okAuth(),
    });
    const r = await h(new Request('http://x'), { role: 'ADMIN' });
    expect(r.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Combined factory
// ---------------------------------------------------------------------------

describe('createAuthzApiHandlers', () => {
  it('returns EVALUATE, REQUIRE, ROLE_PERMISSIONS', () => {
    const s = mockSvc();
    const h = createAuthzApiHandlers(s);
    expect(typeof h.EVALUATE).toBe('function');
    expect(typeof h.REQUIRE).toBe('function');
    expect(typeof h.ROLE_PERMISSIONS).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Route gates — disabled
// ---------------------------------------------------------------------------

describe('Route gate — disabled', () => {
  it('POST evaluate 501', async () => {
    const { POST } = await import('@/app/api/authz/evaluate/route');
    const r = await POST(makeJsonRequest({ permission: 'business.read' }));
    expect(r.status).toBe(501);
    expect((await r.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
  it('POST require 501', async () => {
    const { POST } = await import('@/app/api/authz/require/route');
    const r = await POST(makeJsonRequest({ permission: 'business.read' }));
    expect(r.status).toBe(501);
    expect((await r.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
  it('GET roles/:role/permissions 501', async () => {
    const { GET } = await import(
      '@/app/api/authz/roles/[role]/permissions/route'
    );
    const r = await GET(new Request('http://x'), {
      params: Promise.resolve({ role: 'OWNER' }),
    });
    expect(r.status).toBe(501);
    expect((await r.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
});

// ---------------------------------------------------------------------------
// Route gates — enabled no dev auth
// ---------------------------------------------------------------------------

describe('Route gate — enabled no dev auth', () => {
  it('POST evaluate AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { POST } = await import('@/app/api/authz/evaluate/route');
    const r = await POST(makeJsonRequest({ permission: 'business.read' }));
    expect(r.status).toBe(501);
    expect((await r.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });
  it('POST require AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { POST } = await import('@/app/api/authz/require/route');
    const r = await POST(makeJsonRequest({ permission: 'business.read' }));
    expect(r.status).toBe(501);
    expect((await r.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });
  it('GET roles permissions AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { GET } = await import(
      '@/app/api/authz/roles/[role]/permissions/route'
    );
    const r = await GET(new Request('http://x'), {
      params: Promise.resolve({ role: 'OWNER' }),
    });
    expect(r.status).toBe(501);
    expect((await r.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });
});

// ---------------------------------------------------------------------------
// Route gates — enabled with dev auth
// ---------------------------------------------------------------------------

describe('Route gate — enabled with dev auth', () => {
  it('POST evaluate ok', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const { POST } = await import('@/app/api/authz/evaluate/route');
    const r = await POST(
      makeJsonRequest({ permission: 'business.read' }, {
        headers: devTenantHeaders,
      }),
    );
    expect(r.status).toBe(200);
  });
  it('POST require ok', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const { POST } = await import('@/app/api/authz/require/route');
    const r = await POST(
      makeJsonRequest({ permission: 'business.read' }, {
        headers: devTenantHeaders,
      }),
    );
    expect(r.status).toBe(200);
  });
  it('GET roles permissions ok', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const { GET } = await import(
      '@/app/api/authz/roles/[role]/permissions/route'
    );
    const r = await GET(
      new Request('http://x', {
        headers: { [DEV_AUTH_HEADERS.userId]: USER_ID },
      }),
      { params: Promise.resolve({ role: 'OWNER' }) },
    );
    expect(r.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Scope guards
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '../..');
const FORBID_ROUTE = [
  'getPrisma',
  'PrismaClient',
  'repository',
  'middleware',
  'clerk',
  'next-auth',
  'supabase',
  'jwt',
  'cookie',
];
const FORBID_HANDLER = [...FORBID_ROUTE, 'getApiDependencies'];

describe('Scope guards', () => {
  it('evaluate/route.ts clean', () => {
    const c = fs.readFileSync(
      path.join(ROOT, 'src/app/api/authz/evaluate/route.ts'),
      'utf-8',
    );
    for (const f of FORBID_ROUTE) expect(c).not.toContain(f);
  });
  it('require/route.ts clean', () => {
    const c = fs.readFileSync(
      path.join(ROOT, 'src/app/api/authz/require/route.ts'),
      'utf-8',
    );
    for (const f of FORBID_ROUTE) expect(c).not.toContain(f);
  });
  it('roles/[role]/permissions/route.ts clean', () => {
    const c = fs.readFileSync(
      path.join(
        ROOT,
        'src/app/api/authz/roles/[role]/permissions/route.ts',
      ),
      'utf-8',
    );
    for (const f of FORBID_ROUTE) expect(c).not.toContain(f);
  });
  it('handler.ts clean', () => {
    const c = fs.readFileSync(
      path.join(ROOT, 'src/app/api/authz/handler.ts'),
      'utf-8',
    );
    for (const f of FORBID_HANDLER) expect(c).not.toContain(f);
  });
  it('non-authz placeholders unchanged', () => {
    const c = fs.readFileSync(
      path.join(ROOT, 'src/app/api/identity/users/[userId]/route.ts'),
      'utf-8',
    );
    expect(c).toContain('createPlaceholderRoute');
  });
});
