// ===========================================================================
// Tests — Business Workspace Handlers
// ===========================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  createPostBusinessesHandler,
  createGetBusinessesHandler,
  createGetBusinessByIdHandler,
  createPatchBusinessByIdHandler,
  createBusinessWorkspaceHandlers,
} from '@/app/api/businesses/handler';

import {
  createAuthenticatedUserRequestContext,
  createTenantRequestContext,
  type AuthenticatedUserRequestContext,
  type TenantRequestContext,
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

import type { BusinessIdentity } from '@/domains/tenancy/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BUSINESS_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_BUSINESS_ID = '55555555-5555-4555-8555-555555555555';
const MEMBERSHIP_ID = '66666666-6666-4666-8666-666666666666';

const MOCK_BUSINESS: BusinessIdentity = {
  id: BUSINESS_ID,
  name: 'Demo Business',
  slug: 'demo-business',
  status: 'ACTIVE',
  timezone: 'Asia/Tehran',
  locale: 'fa',
  createdByUserId: USER_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Mock composition
// ---------------------------------------------------------------------------

vi.mock('@/app/api/_shared/composition', () => ({
  getApiDependencies: () => ({
    services: {
      identity: {
        findUserById: vi.fn(),
        updateUser: vi.fn(),
        createSession: vi.fn(),
        listUserSessions: vi.fn(),
        findSessionById: vi.fn(),
        revokeSession: vi.fn(),
      },
      tenancy: {
        createBusiness: vi.fn().mockResolvedValue(ok(MOCK_BUSINESS)),
        listUserBusinesses: vi.fn().mockResolvedValue(ok([MOCK_BUSINESS])),
        findBusinessById: vi.fn().mockResolvedValue(ok(MOCK_BUSINESS)),
        updateBusiness: vi.fn().mockResolvedValue(ok(MOCK_BUSINESS)),
      },
      authz: {
        requirePermission: vi.fn().mockResolvedValue(ok({ allowed: true })),
      },
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockServices() {
  return {
    tenancyService: {
      createBusiness: vi.fn(),
      listUserBusinesses: vi.fn(),
      findBusinessById: vi.fn(),
      updateBusiness: vi.fn(),
    },
    authzService: {
      requirePermission: vi.fn(),
    },
  };
}

function successAuthResolver(
  userId = USER_ID,
): (req: Request) => Promise<ContextResult<AuthenticatedUserRequestContext>> {
  return async () => ({
    ok: true as const,
    context: createAuthenticatedUserRequestContext({ requestId: null, userId }),
  });
}

function successTenantResolver(
  opts: { userId?: string; businessId?: string; membershipId?: string; role?: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER' } = {},
): (req: Request) => Promise<ContextResult<TenantRequestContext>> {
  return async () => ({
    ok: true as const,
    context: createTenantRequestContext({
      requestId: null,
      tenant: {
        userId: opts.userId ?? USER_ID,
        businessId: opts.businessId ?? BUSINESS_ID,
        membershipId: opts.membershipId ?? MEMBERSHIP_ID,
        role: opts.role ?? 'OWNER',
      },
    }),
  });
}

function failingResolver<T>(): (req: Request) => Promise<ContextResult<T>> {
  return async () => ({
    ok: false as const,
    response: apiError('AUTH_CONTEXT_UNAVAILABLE', 'Auth unavailable', 501),
  });
}

// ---------------------------------------------------------------------------
// Env save/restore
// ---------------------------------------------------------------------------

let prevApi: string | undefined;
let prevDev: string | undefined;

beforeEach(() => {
  prevApi = process.env[API_HANDLERS_FEATURE_FLAG];
  prevDev = process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
  delete process.env[API_HANDLERS_FEATURE_FLAG];
  delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
});

afterEach(() => {
  if (prevApi !== undefined) process.env[API_HANDLERS_FEATURE_FLAG] = prevApi;
  else delete process.env[API_HANDLERS_FEATURE_FLAG];
  if (prevDev !== undefined) process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = prevDev;
  else delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
});

// ---------------------------------------------------------------------------
// 1. POST handler
// ---------------------------------------------------------------------------

describe('createPostBusinessesHandler', () => {
  it('returns AUTH_CONTEXT_UNAVAILABLE when context fails', async () => {
    const s = createMockServices();
    const h = createPostBusinessesHandler({ ...s, resolveAuthenticatedContext: failingResolver() });
    const res = await h(makeJsonRequest({ name: 'X', slug: 'xxx' }));
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    expect(s.tenancyService.createBusiness).not.toHaveBeenCalled();
  });

  it('rejects invalid body after context succeeds', async () => {
    const s = createMockServices();
    const h = createPostBusinessesHandler({ ...s, resolveAuthenticatedContext: successAuthResolver() });
    const res = await h(makeJsonRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_TENANCY_INPUT');
    expect(s.tenancyService.createBusiness).not.toHaveBeenCalled();
  });

  it('creates business using context userId, not body createdByUserId', async () => {
    const s = createMockServices();
    s.tenancyService.createBusiness.mockResolvedValue(ok(MOCK_BUSINESS));
    const h = createPostBusinessesHandler({ ...s, resolveAuthenticatedContext: successAuthResolver(USER_ID) });
    const res = await h(makeJsonRequest({ name: 'Demo Business', slug: 'demo-business' }));
    expect(res.status).toBe(200);
    expect(s.tenancyService.createBusiness).toHaveBeenCalledOnce();
    const args = s.tenancyService.createBusiness.mock.calls[0][0];
    expect(args.createdByUserId).toBe(USER_ID);
  });

  it('passes service error through', async () => {
    const s = createMockServices();
    s.tenancyService.createBusiness.mockResolvedValue(err('BUSINESS_SLUG_ALREADY_EXISTS', 'Slug taken'));
    const h = createPostBusinessesHandler({ ...s, resolveAuthenticatedContext: successAuthResolver() });
    const res = await h(makeJsonRequest({ name: 'Demo', slug: 'demo-business' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('BUSINESS_SLUG_ALREADY_EXISTS');
  });
});

// ---------------------------------------------------------------------------
// 2. GET handler
// ---------------------------------------------------------------------------

describe('createGetBusinessesHandler', () => {
  it('returns AUTH_CONTEXT_UNAVAILABLE when context fails', async () => {
    const s = createMockServices();
    const h = createGetBusinessesHandler({ ...s, resolveAuthenticatedContext: failingResolver() });
    const res = await h(new Request('http://localhost/api/businesses'));
    expect(res.status).toBe(501);
    expect(s.tenancyService.listUserBusinesses).not.toHaveBeenCalled();
  });

  it('lists businesses for context userId', async () => {
    const s = createMockServices();
    s.tenancyService.listUserBusinesses.mockResolvedValue(ok([MOCK_BUSINESS]));
    const h = createGetBusinessesHandler({ ...s, resolveAuthenticatedContext: successAuthResolver() });
    const res = await h(new Request('http://localhost/api/businesses'));
    expect(res.status).toBe(200);
    expect(s.tenancyService.listUserBusinesses).toHaveBeenCalledWith({ userId: USER_ID, includeInactive: false });
  });

  it('parses includeInactive=true', async () => {
    const s = createMockServices();
    s.tenancyService.listUserBusinesses.mockResolvedValue(ok([MOCK_BUSINESS]));
    const h = createGetBusinessesHandler({ ...s, resolveAuthenticatedContext: successAuthResolver() });
    const res = await h(new Request('http://localhost/api/businesses?includeInactive=true'));
    expect(res.status).toBe(200);
    expect(s.tenancyService.listUserBusinesses).toHaveBeenCalledWith({ userId: USER_ID, includeInactive: true });
  });
});

// ---------------------------------------------------------------------------
// 3. GET by ID handler
// ---------------------------------------------------------------------------

describe('createGetBusinessByIdHandler', () => {
  it('returns AUTH_CONTEXT_UNAVAILABLE when tenant context fails', async () => {
    const s = createMockServices();
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: failingResolver() });
    const res = await h(new Request('http://localhost/api/businesses/' + BUSINESS_ID), { businessId: BUSINESS_ID });
    expect(res.status).toBe(501);
    expect(s.authzService.requirePermission).not.toHaveBeenCalled();
    expect(s.tenancyService.findBusinessById).not.toHaveBeenCalled();
  });

  it('rejects invalid businessId param', async () => {
    const s = createMockServices();
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver() });
    const res = await h(new Request('http://localhost/api/businesses/bad'), { businessId: 'not-uuid' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_TENANCY_INPUT');
    expect(s.authzService.requirePermission).not.toHaveBeenCalled();
  });

  it('rejects route businessId mismatch with TENANT_ACCESS_DENIED', async () => {
    const s = createMockServices();
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver({ businessId: BUSINESS_ID }) });
    const res = await h(new Request('http://localhost/api/businesses/' + OTHER_BUSINESS_ID), { businessId: OTHER_BUSINESS_ID });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('TENANT_ACCESS_DENIED');
    expect(s.authzService.requirePermission).not.toHaveBeenCalled();
  });

  it('returns ACCESS_DENIED when authz denies', async () => {
    const s = createMockServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: false, reason: 'Denied' }));
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver() });
    const res = await h(new Request('http://localhost/api/businesses/' + BUSINESS_ID), { businessId: BUSINESS_ID });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('ACCESS_DENIED');
    expect(s.tenancyService.findBusinessById).not.toHaveBeenCalled();
  });

  it('returns BUSINESS_NOT_FOUND when findBusinessById returns ok(null)', async () => {
    const s = createMockServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.findBusinessById.mockResolvedValue(ok(null));
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver() });
    const res = await h(new Request('http://localhost/api/businesses/' + BUSINESS_ID), { businessId: BUSINESS_ID });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('BUSINESS_NOT_FOUND');
  });

  it('returns business when authz allows and business exists', async () => {
    const s = createMockServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.findBusinessById.mockResolvedValue(ok(MOCK_BUSINESS));
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver() });
    const res = await h(new Request('http://localhost/api/businesses/' + BUSINESS_ID), { businessId: BUSINESS_ID });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(BUSINESS_ID);
  });
});

// ---------------------------------------------------------------------------
// 4. PATCH by ID handler
// ---------------------------------------------------------------------------

describe('createPatchBusinessByIdHandler', () => {
  it('returns AUTH_CONTEXT_UNAVAILABLE when tenant context fails', async () => {
    const s = createMockServices();
    const h = createPatchBusinessByIdHandler({ ...s, resolveTenantContext: failingResolver() });
    const res = await h(makeJsonRequest({ name: 'New' }), { businessId: BUSINESS_ID });
    expect(res.status).toBe(501);
    expect(s.authzService.requirePermission).not.toHaveBeenCalled();
    expect(s.tenancyService.updateBusiness).not.toHaveBeenCalled();
  });

  it('rejects invalid businessId param', async () => {
    const s = createMockServices();
    const h = createPatchBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver() });
    const res = await h(makeJsonRequest({ name: 'New' }), { businessId: 'bad' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_TENANCY_INPUT');
  });

  it('rejects route businessId mismatch with TENANT_ACCESS_DENIED', async () => {
    const s = createMockServices();
    const h = createPatchBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver({ businessId: BUSINESS_ID }) });
    const res = await h(makeJsonRequest({ name: 'New' }), { businessId: OTHER_BUSINESS_ID });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('TENANT_ACCESS_DENIED');
  });

  it('returns ACCESS_DENIED when authz denies', async () => {
    const s = createMockServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: false, reason: 'Denied' }));
    const h = createPatchBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver() });
    const res = await h(makeJsonRequest({ name: 'New' }), { businessId: BUSINESS_ID });
    expect(res.status).toBe(403);
    expect(s.tenancyService.updateBusiness).not.toHaveBeenCalled();
  });

  it('rejects invalid empty body', async () => {
    const s = createMockServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    const h = createPatchBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver() });
    const res = await h(makeJsonRequest({}), { businessId: BUSINESS_ID });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_TENANCY_INPUT');
    expect(s.tenancyService.updateBusiness).not.toHaveBeenCalled();
  });

  it('updates business with route businessId', async () => {
    const s = createMockServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.updateBusiness.mockResolvedValue(ok({ ...MOCK_BUSINESS, name: 'Updated' }));
    const h = createPatchBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver() });
    const res = await h(makeJsonRequest({ name: 'Updated' }), { businessId: BUSINESS_ID });
    expect(res.status).toBe(200);
    expect(s.tenancyService.updateBusiness).toHaveBeenCalledOnce();
    const args = s.tenancyService.updateBusiness.mock.calls[0][0];
    expect(args.businessId).toBe(BUSINESS_ID);
    expect(args.name).toBe('Updated');
  });

  it('passes service error through', async () => {
    const s = createMockServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.updateBusiness.mockResolvedValue(err('BUSINESS_SLUG_ALREADY_EXISTS', 'Slug taken'));
    const h = createPatchBusinessByIdHandler({ ...s, resolveTenantContext: successTenantResolver() });
    const res = await h(makeJsonRequest({ slug: 'taken-slug' }), { businessId: BUSINESS_ID });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// 5. Combined factory
// ---------------------------------------------------------------------------

describe('createBusinessWorkspaceHandlers', () => {
  it('returns POST, GET, GET_BY_ID, PATCH_BY_ID functions', () => {
    const s = createMockServices();
    const handlers = createBusinessWorkspaceHandlers(s);
    expect(typeof handlers.POST).toBe('function');
    expect(typeof handlers.GET).toBe('function');
    expect(typeof handlers.GET_BY_ID).toBe('function');
    expect(typeof handlers.PATCH_BY_ID).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 6. Route feature-gate — disabled
// ---------------------------------------------------------------------------

describe('Route feature-gate — disabled', () => {
  it('POST /api/businesses returns NOT_IMPLEMENTED', async () => {
    const { POST } = await import('@/app/api/businesses/route');
    const res = await POST(makeJsonRequest({ name: 'X', slug: 'xxx' }));
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/businesses returns NOT_IMPLEMENTED', async () => {
    const { GET } = await import('@/app/api/businesses/route');
    const res = await GET(new Request('http://localhost/api/businesses'));
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/businesses/:businessId returns NOT_IMPLEMENTED', async () => {
    const { GET } = await import('@/app/api/businesses/[businessId]/route');
    const res = await GET(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID),
      { params: Promise.resolve({ businessId: BUSINESS_ID }) },
    );
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('NOT_IMPLEMENTED');
  });

  it('PATCH /api/businesses/:businessId returns NOT_IMPLEMENTED', async () => {
    const { PATCH } = await import('@/app/api/businesses/[businessId]/route');
    const res = await PATCH(
      makeJsonRequest({ name: 'X' }),
      { params: Promise.resolve({ businessId: BUSINESS_ID }) },
    );
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
});

// ---------------------------------------------------------------------------
// 7. Route feature-gate — enabled without dev auth
// ---------------------------------------------------------------------------

describe('Route feature-gate — enabled without dev auth', () => {
  it('POST /api/businesses returns AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { POST } = await import('@/app/api/businesses/route');
    const res = await POST(makeJsonRequest({ name: 'X', slug: 'xxx' }));
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });

  it('GET /api/businesses returns AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { GET } = await import('@/app/api/businesses/route');
    const res = await GET(new Request('http://localhost/api/businesses'));
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });

  it('GET /api/businesses/:businessId returns AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { GET } = await import('@/app/api/businesses/[businessId]/route');
    const res = await GET(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID),
      { params: Promise.resolve({ businessId: BUSINESS_ID }) },
    );
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });

  it('PATCH /api/businesses/:businessId returns AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { PATCH } = await import('@/app/api/businesses/[businessId]/route');
    const res = await PATCH(
      makeJsonRequest({ name: 'X' }),
      { params: Promise.resolve({ businessId: BUSINESS_ID }) },
    );
    expect(res.status).toBe(501);
    expect((await res.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });
});

// ---------------------------------------------------------------------------
// 8. Route feature-gate — enabled with dev auth
// ---------------------------------------------------------------------------

describe('Route feature-gate — enabled with dev auth', () => {
  it('POST /api/businesses returns ok from mocked createBusiness', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const { POST } = await import('@/app/api/businesses/route');
    const res = await POST(
      makeJsonRequest({ name: 'Demo Business', slug: 'demo-business' }, { headers: { [DEV_AUTH_HEADERS.userId]: USER_ID } }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it('GET /api/businesses returns ok from mocked listUserBusinesses', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const { GET } = await import('@/app/api/businesses/route');
    const res = await GET(new Request('http://localhost/api/businesses', { headers: { [DEV_AUTH_HEADERS.userId]: USER_ID } }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it('GET /api/businesses/:businessId returns ok from mocked findBusinessById', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const { GET } = await import('@/app/api/businesses/[businessId]/route');
    const res = await GET(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID, {
        headers: {
          [DEV_AUTH_HEADERS.userId]: USER_ID,
          [DEV_AUTH_HEADERS.businessId]: BUSINESS_ID,
          [DEV_AUTH_HEADERS.membershipId]: MEMBERSHIP_ID,
          [DEV_AUTH_HEADERS.role]: 'OWNER',
        },
      }),
      { params: Promise.resolve({ businessId: BUSINESS_ID }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it('PATCH /api/businesses/:businessId returns ok from mocked updateBusiness', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const { PATCH } = await import('@/app/api/businesses/[businessId]/route');
    const res = await PATCH(
      makeJsonRequest({ name: 'Updated' }, {
        headers: {
          [DEV_AUTH_HEADERS.userId]: USER_ID,
          [DEV_AUTH_HEADERS.businessId]: BUSINESS_ID,
          [DEV_AUTH_HEADERS.membershipId]: MEMBERSHIP_ID,
          [DEV_AUTH_HEADERS.role]: 'OWNER',
        },
      }),
      { params: Promise.resolve({ businessId: BUSINESS_ID }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Scope guards
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Scope guards', () => {
  const FORBIDDEN_ROUTE = ['getPrisma', 'PrismaClient', 'repository', 'middleware', 'clerk', 'next-auth', 'supabase', 'jwt', 'cookie'];
  const FORBIDDEN_HANDLER = [...FORBIDDEN_ROUTE, 'getApiDependencies'];

  it('businesses route.ts must not contain forbidden imports', () => {
    const c = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/api/businesses/route.ts'), 'utf-8');
    for (const f of FORBIDDEN_ROUTE) expect(c).not.toContain(f);
  });

  it('businesses/[businessId]/route.ts must not contain forbidden imports', () => {
    const c = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/api/businesses/[businessId]/route.ts'), 'utf-8');
    for (const f of FORBIDDEN_ROUTE) expect(c).not.toContain(f);
  });

  it('handler.ts must not contain forbidden imports', () => {
    const c = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/api/businesses/handler.ts'), 'utf-8');
    for (const f of FORBIDDEN_HANDLER) expect(c).not.toContain(f);
  });

  it('non-business placeholder routes remain unchanged', () => {
    const placeholders = [
      'src/app/api/identity/users/[userId]/route.ts',
      'src/app/api/authz/evaluate/route.ts',
    ];
    for (const rp of placeholders) {
      const c = fs.readFileSync(path.join(PROJECT_ROOT, rp), 'utf-8');
      expect(c).toContain('createPlaceholderRoute');
      expect(c).not.toContain('businesses/handler');
    }
  });
});
