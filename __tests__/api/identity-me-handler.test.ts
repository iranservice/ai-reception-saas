// ===========================================================================
// Tests — Identity Self-Profile Handlers
//
// Verifies handler module behavior, route feature-gate behavior,
// and scope guards for GET/PATCH /api/identity/me.
// No server startup, DB, or auth required.
// ===========================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  createGetIdentityMeHandler,
  createPatchIdentityMeHandler,
  createIdentityMeHandlers,
} from '@/app/api/identity/me/handler';

import {
  createAuthenticatedUserRequestContext,
  type AuthenticatedUserRequestContext,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import { apiError } from '@/app/api/_shared/responses';
import { makeJsonRequest } from '@/app/api/_shared/request';
import { ok, err } from '@/lib/result';

import type { UserIdentity } from '@/domains/identity/types';
import { API_HANDLERS_FEATURE_FLAG } from '@/app/api/_shared/feature-gate';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const MOCK_USER: UserIdentity = {
  id: 'user-001',
  email: 'test@example.com',
  name: 'Test User',
  locale: 'en',
  status: 'ACTIVE',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createMockIdentityService() {
  return {
    findUserById: vi.fn(),
    updateUser: vi.fn(),
  };
}

function createSuccessfulResolver(
  userId = 'user-001',
  requestId: string | null = null,
): (request: Request) => Promise<ContextResult<AuthenticatedUserRequestContext>> {
  return async () => ({
    ok: true as const,
    context: createAuthenticatedUserRequestContext({ requestId, userId }),
  });
}

function createFailingResolver(): (
  request: Request,
) => Promise<ContextResult<AuthenticatedUserRequestContext>> {
  return async () => ({
    ok: false as const,
    response: apiError(
      'AUTH_CONTEXT_UNAVAILABLE',
      'Authentication context is not implemented yet',
      501,
    ),
  });
}

// ---------------------------------------------------------------------------
// 1. GET handler — createGetIdentityMeHandler
// ---------------------------------------------------------------------------

describe('createGetIdentityMeHandler', () => {
  it('returns AUTH_CONTEXT_UNAVAILABLE when context resolver fails', async () => {
    const service = createMockIdentityService();
    const handler = createGetIdentityMeHandler({
      identityService: service,
      resolveContext: createFailingResolver(),
    });

    const res = await handler(new Request('http://localhost/api/identity/me'));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');

    expect(service.findUserById).not.toHaveBeenCalled();
  });

  it('calls identityService.findUserById when context succeeds', async () => {
    const service = createMockIdentityService();
    service.findUserById.mockResolvedValue(ok(MOCK_USER));

    const handler = createGetIdentityMeHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver('user-001'),
    });

    const res = await handler(new Request('http://localhost/api/identity/me'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe('user-001');

    expect(service.findUserById).toHaveBeenCalledOnce();
    expect(service.findUserById).toHaveBeenCalledWith({ userId: 'user-001' });
  });

  it('passes service error through', async () => {
    const service = createMockIdentityService();
    service.findUserById.mockResolvedValue(
      err('USER_NOT_FOUND', 'User not found'),
    );

    const handler = createGetIdentityMeHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver('user-999'),
    });

    const res = await handler(new Request('http://localhost/api/identity/me'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('USER_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// 2. PATCH handler — createPatchIdentityMeHandler
// ---------------------------------------------------------------------------

describe('createPatchIdentityMeHandler', () => {
  it('returns AUTH_CONTEXT_UNAVAILABLE when context fails', async () => {
    const service = createMockIdentityService();
    const handler = createPatchIdentityMeHandler({
      identityService: service,
      resolveContext: createFailingResolver(),
    });

    const req = makeJsonRequest({ name: 'New Name' });
    const res = await handler(req);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');

    expect(service.updateUser).not.toHaveBeenCalled();
  });

  it('validates body after context succeeds — rejects invalid body', async () => {
    const service = createMockIdentityService();
    const handler = createPatchIdentityMeHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver('user-001'),
    });

    // Empty object fails updateUserInputSchema refinement (no fields provided)
    const req = makeJsonRequest({});
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_IDENTITY_INPUT');

    expect(service.updateUser).not.toHaveBeenCalled();
  });

  it('calls updateUser with context userId and parsed body', async () => {
    const service = createMockIdentityService();
    const updatedUser = { ...MOCK_USER, name: 'New Name' };
    service.updateUser.mockResolvedValue(ok(updatedUser));

    const handler = createPatchIdentityMeHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver('user-001'),
    });

    const req = makeJsonRequest({ name: 'New Name' });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('New Name');

    expect(service.updateUser).toHaveBeenCalledOnce();
    expect(service.updateUser).toHaveBeenCalledWith('user-001', {
      name: 'New Name',
    });
  });

  it('passes service error through', async () => {
    const service = createMockIdentityService();
    service.updateUser.mockResolvedValue(
      err('IDENTITY_REPOSITORY_ERROR', 'Identity repository operation failed'),
    );

    const handler = createPatchIdentityMeHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver('user-001'),
    });

    const req = makeJsonRequest({ name: 'Updated' });
    const res = await handler(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('IDENTITY_REPOSITORY_ERROR');
  });
});

// ---------------------------------------------------------------------------
// 3. createIdentityMeHandlers
// ---------------------------------------------------------------------------

describe('createIdentityMeHandlers', () => {
  it('returns GET and PATCH functions', () => {
    const service = createMockIdentityService();
    const handlers = createIdentityMeHandlers({ identityService: service });
    expect(typeof handlers.GET).toBe('function');
    expect(typeof handlers.PATCH).toBe('function');
  });
});

// Mock composition to avoid Prisma/DATABASE_URL initialization in route tests
vi.mock('@/app/api/_shared/composition', () => ({
  getApiDependencies: () => ({
    services: {
      identity: {
        findUserById: vi.fn(),
        updateUser: vi.fn(),
      },
    },
  }),
}));

describe('Route feature-gate behavior', () => {
  let prevEnableApiHandlers: string | undefined;

  beforeEach(() => {
    prevEnableApiHandlers = process.env[API_HANDLERS_FEATURE_FLAG];
    delete process.env[API_HANDLERS_FEATURE_FLAG];
  });

  afterEach(() => {
    if (prevEnableApiHandlers !== undefined) {
      process.env[API_HANDLERS_FEATURE_FLAG] = prevEnableApiHandlers;
    } else {
      delete process.env[API_HANDLERS_FEATURE_FLAG];
    }
  });

  it('GET /api/identity/me returns NOT_IMPLEMENTED when ENABLE_API_HANDLERS missing', async () => {
    const { GET } = await import('@/app/api/identity/me/route');
    const res = await GET(new Request('http://localhost/api/identity/me'));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('PATCH /api/identity/me returns NOT_IMPLEMENTED when ENABLE_API_HANDLERS missing', async () => {
    const { PATCH } = await import('@/app/api/identity/me/route');
    const res = await PATCH(
      makeJsonRequest({ name: 'Test' }, { method: 'PATCH' }),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/identity/me returns AUTH_CONTEXT_UNAVAILABLE when ENABLE_API_HANDLERS=true', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { GET } = await import('@/app/api/identity/me/route');
    const res = await GET(new Request('http://localhost/api/identity/me'));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });

  it('PATCH /api/identity/me returns AUTH_CONTEXT_UNAVAILABLE when ENABLE_API_HANDLERS=true', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { PATCH } = await import('@/app/api/identity/me/route');
    const res = await PATCH(
      makeJsonRequest({ name: 'Test' }, { method: 'PATCH' }),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });
});

// ---------------------------------------------------------------------------
// 5. Scope guards
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Scope guards', () => {
  const ROUTE_PATH = path.join(
    PROJECT_ROOT,
    'src/app/api/identity/me/route.ts',
  );
  const HANDLER_PATH = path.join(
    PROJECT_ROOT,
    'src/app/api/identity/me/handler.ts',
  );

  const FORBIDDEN_IN_ROUTE = [
    'getPrisma',
    'PrismaClient',
    'middleware',
    'clerk',
    'next-auth',
    'supabase',
  ];

  const FORBIDDEN_IN_HANDLER = [
    'getPrisma',
    'PrismaClient',
    'middleware',
    'clerk',
    'next-auth',
    'supabase',
  ];

  it('route.ts must not contain forbidden imports', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    for (const forbidden of FORBIDDEN_IN_ROUTE) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('handler.ts must not contain forbidden imports', () => {
    const content = fs.readFileSync(HANDLER_PATH, 'utf-8');
    for (const forbidden of FORBIDDEN_IN_HANDLER) {
      expect(content).not.toContain(forbidden);
    }
  });

  const OTHER_ROUTE_FILES = [
    'src/app/api/identity/users/[userId]/route.ts',
    'src/app/api/businesses/route.ts',
    'src/app/api/businesses/[businessId]/route.ts',
    'src/app/api/businesses/[businessId]/memberships/route.ts',
    'src/app/api/businesses/[businessId]/memberships/[membershipId]/role/route.ts',
    'src/app/api/businesses/[businessId]/memberships/[membershipId]/status/route.ts',
    'src/app/api/businesses/[businessId]/memberships/[membershipId]/route.ts',
    'src/app/api/businesses/[businessId]/audit-events/route.ts',
    'src/app/api/businesses/[businessId]/audit-events/[auditEventId]/route.ts',
    'src/app/api/authz/evaluate/route.ts',
    'src/app/api/authz/require/route.ts',
    'src/app/api/authz/roles/[role]/permissions/route.ts',
  ];

  it('other route files remain placeholder-only and do not import handler module', () => {
    for (const routePath of OTHER_ROUTE_FILES) {
      const fullPath = path.join(PROJECT_ROOT, routePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).toContain('createPlaceholderRoute');
      expect(content).not.toContain('identity/me/handler');
    }
  });
});
