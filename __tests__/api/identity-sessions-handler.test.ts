// ===========================================================================
// Tests — Identity Session Handlers
//
// Verifies handler module behavior, route feature-gate behavior,
// and scope guards for identity session endpoints.
// No server startup, DB, or auth required.
// ===========================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  createPostIdentitySessionsHandler,
  createGetIdentitySessionsHandler,
  createPostRevokeIdentitySessionHandler,
  createIdentitySessionHandlers,
} from '@/app/api/identity/sessions/handler';

import {
  createAuthenticatedUserRequestContext,
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

import type { SessionIdentity } from '@/domains/identity/types';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333';
const FIXED_NOW = new Date('2026-06-01T00:00:00.000Z');

const MOCK_SESSION: SessionIdentity = {
  id: SESSION_ID,
  userId: USER_ID,
  tokenHash: 'a'.repeat(64),
  expiresAt: '2026-12-31T00:00:00.000Z',
  revokedAt: null,
  ipAddress: null,
  userAgent: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Mock composition to avoid Prisma/DATABASE_URL initialization
// ---------------------------------------------------------------------------

vi.mock('@/app/api/_shared/composition', () => ({
  getApiDependencies: () => ({
    services: {
      identity: {
        createSession: vi.fn().mockResolvedValue(ok(MOCK_SESSION)),
        listUserSessions: vi.fn().mockResolvedValue(ok([MOCK_SESSION])),
        findSessionById: vi.fn().mockResolvedValue(ok(MOCK_SESSION)),
        revokeSession: vi
          .fn()
          .mockResolvedValue(
            ok({ ...MOCK_SESSION, revokedAt: FIXED_NOW.toISOString() }),
          ),
      },
    },
  }),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockIdentityService() {
  return {
    createSession: vi.fn(),
    listUserSessions: vi.fn(),
    findSessionById: vi.fn(),
    revokeSession: vi.fn(),
  };
}

function createSuccessfulResolver(
  userId = USER_ID,
): (
  request: Request,
) => Promise<ContextResult<AuthenticatedUserRequestContext>> {
  return async () => ({
    ok: true as const,
    context: createAuthenticatedUserRequestContext({
      requestId: null,
      userId,
    }),
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

function devRequest(
  headers: Record<string, string>,
  url = 'http://localhost/api/identity/sessions',
): Request {
  return new Request(url, { headers });
}

// ---------------------------------------------------------------------------
// Env save/restore
// ---------------------------------------------------------------------------

let prevApiHandlers: string | undefined;
let prevDevAuth: string | undefined;

beforeEach(() => {
  prevApiHandlers = process.env[API_HANDLERS_FEATURE_FLAG];
  prevDevAuth = process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
  delete process.env[API_HANDLERS_FEATURE_FLAG];
  delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
});

afterEach(() => {
  if (prevApiHandlers !== undefined) {
    process.env[API_HANDLERS_FEATURE_FLAG] = prevApiHandlers;
  } else {
    delete process.env[API_HANDLERS_FEATURE_FLAG];
  }
  if (prevDevAuth !== undefined) {
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = prevDevAuth;
  } else {
    delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
  }
});

// ---------------------------------------------------------------------------
// 1. POST handler — createPostIdentitySessionsHandler
// ---------------------------------------------------------------------------

describe('createPostIdentitySessionsHandler', () => {
  it('returns AUTH_CONTEXT_UNAVAILABLE when context fails', async () => {
    const service = createMockIdentityService();
    const handler = createPostIdentitySessionsHandler({
      identityService: service,
      resolveContext: createFailingResolver(),
    });

    const req = makeJsonRequest({
      tokenHash: 'a'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    const res = await handler(req);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    expect(service.createSession).not.toHaveBeenCalled();
  });

  it('rejects invalid body after context succeeds', async () => {
    const service = createMockIdentityService();
    const handler = createPostIdentitySessionsHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver(),
    });

    // Missing tokenHash and expiresAt
    const req = makeJsonRequest({});
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_IDENTITY_INPUT');
    expect(service.createSession).not.toHaveBeenCalled();
  });

  it('creates session using context userId, not body userId', async () => {
    const service = createMockIdentityService();
    service.createSession.mockResolvedValue(ok(MOCK_SESSION));

    const handler = createPostIdentitySessionsHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver(USER_ID),
    });

    // Body attempts to inject a different userId
    const req = makeJsonRequest({
      tokenHash: 'a'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    const res = await handler(req);
    expect(res.status).toBe(200);

    expect(service.createSession).toHaveBeenCalledOnce();
    const callArgs = service.createSession.mock.calls[0][0];
    expect(callArgs.userId).toBe(USER_ID);
    expect(callArgs.tokenHash).toBe('a'.repeat(64));
  });

  it('passes service error through', async () => {
    const service = createMockIdentityService();
    service.createSession.mockResolvedValue(
      err('IDENTITY_REPOSITORY_ERROR', 'DB failed'),
    );

    const handler = createPostIdentitySessionsHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver(),
    });

    const req = makeJsonRequest({
      tokenHash: 'a'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    const res = await handler(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('IDENTITY_REPOSITORY_ERROR');
  });
});

// ---------------------------------------------------------------------------
// 2. GET handler — createGetIdentitySessionsHandler
// ---------------------------------------------------------------------------

describe('createGetIdentitySessionsHandler', () => {
  it('returns AUTH_CONTEXT_UNAVAILABLE when context fails', async () => {
    const service = createMockIdentityService();
    const handler = createGetIdentitySessionsHandler({
      identityService: service,
      resolveContext: createFailingResolver(),
    });

    const req = new Request('http://localhost/api/identity/sessions');
    const res = await handler(req);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    expect(service.listUserSessions).not.toHaveBeenCalled();
  });

  it('lists sessions for context userId', async () => {
    const service = createMockIdentityService();
    service.listUserSessions.mockResolvedValue(ok([MOCK_SESSION]));

    const handler = createGetIdentitySessionsHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver(USER_ID),
    });

    const req = new Request('http://localhost/api/identity/sessions');
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);

    expect(service.listUserSessions).toHaveBeenCalledOnce();
    expect(service.listUserSessions).toHaveBeenCalledWith({
      userId: USER_ID,
      includeRevoked: false,
    });
  });

  it('parses includeRevoked=true', async () => {
    const service = createMockIdentityService();
    service.listUserSessions.mockResolvedValue(ok([MOCK_SESSION]));

    const handler = createGetIdentitySessionsHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver(USER_ID),
    });

    const req = new Request(
      'http://localhost/api/identity/sessions?includeRevoked=true',
    );
    const res = await handler(req);
    expect(res.status).toBe(200);

    expect(service.listUserSessions).toHaveBeenCalledWith({
      userId: USER_ID,
      includeRevoked: true,
    });
  });
});

// ---------------------------------------------------------------------------
// 3. REVOKE handler — createPostRevokeIdentitySessionHandler
// ---------------------------------------------------------------------------

describe('createPostRevokeIdentitySessionHandler', () => {
  it('returns AUTH_CONTEXT_UNAVAILABLE when context fails', async () => {
    const service = createMockIdentityService();
    const handler = createPostRevokeIdentitySessionHandler({
      identityService: service,
      resolveContext: createFailingResolver(),
    });

    const req = new Request('http://localhost/api/identity/sessions/x/revoke', {
      method: 'POST',
    });
    const res = await handler(req, { sessionId: SESSION_ID });
    expect(res.status).toBe(501);
    expect(service.findSessionById).not.toHaveBeenCalled();
    expect(service.revokeSession).not.toHaveBeenCalled();
  });

  it('rejects invalid sessionId param', async () => {
    const service = createMockIdentityService();
    const handler = createPostRevokeIdentitySessionHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver(),
    });

    const req = new Request('http://localhost/api/identity/sessions/x/revoke', {
      method: 'POST',
    });
    const res = await handler(req, { sessionId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_IDENTITY_INPUT');
    expect(service.findSessionById).not.toHaveBeenCalled();
    expect(service.revokeSession).not.toHaveBeenCalled();
  });

  it('returns SESSION_NOT_FOUND when findSessionById returns ok(null)', async () => {
    const service = createMockIdentityService();
    service.findSessionById.mockResolvedValue(ok(null));

    const handler = createPostRevokeIdentitySessionHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver(),
    });

    const req = new Request('http://localhost/api/identity/sessions/x/revoke', {
      method: 'POST',
    });
    const res = await handler(req, { sessionId: SESSION_ID });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('SESSION_NOT_FOUND');
    expect(service.revokeSession).not.toHaveBeenCalled();
  });

  it('returns ACCESS_DENIED when session.userId does not match context', async () => {
    const service = createMockIdentityService();
    service.findSessionById.mockResolvedValue(
      ok({ ...MOCK_SESSION, userId: OTHER_USER_ID }),
    );

    const handler = createPostRevokeIdentitySessionHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver(USER_ID),
    });

    const req = new Request('http://localhost/api/identity/sessions/x/revoke', {
      method: 'POST',
    });
    const res = await handler(req, { sessionId: SESSION_ID });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ACCESS_DENIED');
    expect(service.revokeSession).not.toHaveBeenCalled();
  });

  it('revokes owned session with fixed now()', async () => {
    const service = createMockIdentityService();
    service.findSessionById.mockResolvedValue(ok(MOCK_SESSION));
    service.revokeSession.mockResolvedValue(
      ok({ ...MOCK_SESSION, revokedAt: FIXED_NOW.toISOString() }),
    );

    const handler = createPostRevokeIdentitySessionHandler({
      identityService: service,
      resolveContext: createSuccessfulResolver(USER_ID),
      now: () => FIXED_NOW,
    });

    const req = new Request('http://localhost/api/identity/sessions/x/revoke', {
      method: 'POST',
    });
    const res = await handler(req, { sessionId: SESSION_ID });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.revokedAt).toBe(FIXED_NOW.toISOString());

    expect(service.revokeSession).toHaveBeenCalledOnce();
    expect(service.revokeSession).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      revokedAt: FIXED_NOW.toISOString(),
    });
  });
});

// ---------------------------------------------------------------------------
// 4. createIdentitySessionHandlers
// ---------------------------------------------------------------------------

describe('createIdentitySessionHandlers', () => {
  it('returns POST, GET, and REVOKE functions', () => {
    const service = createMockIdentityService();
    const handlers = createIdentitySessionHandlers({
      identityService: service,
    });
    expect(typeof handlers.POST).toBe('function');
    expect(typeof handlers.GET).toBe('function');
    expect(typeof handlers.REVOKE).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 5. Route feature-gate behavior — disabled
// ---------------------------------------------------------------------------

describe('Route feature-gate — disabled', () => {
  it('POST /api/identity/sessions returns NOT_IMPLEMENTED', async () => {
    const { POST } = await import('@/app/api/identity/sessions/route');
    const res = await POST(
      makeJsonRequest({
        tokenHash: 'a'.repeat(64),
        expiresAt: '2026-12-31T00:00:00.000Z',
      }),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/identity/sessions returns NOT_IMPLEMENTED', async () => {
    const { GET } = await import('@/app/api/identity/sessions/route');
    const res = await GET(
      new Request('http://localhost/api/identity/sessions'),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST revoke returns NOT_IMPLEMENTED', async () => {
    const { POST } = await import(
      '@/app/api/identity/sessions/[sessionId]/revoke/route'
    );
    const res = await POST(
      new Request('http://localhost/api/identity/sessions/x/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });
});

// ---------------------------------------------------------------------------
// 6. Route feature-gate — enabled without dev auth
// ---------------------------------------------------------------------------

describe('Route feature-gate — enabled without dev auth', () => {
  it('POST /api/identity/sessions returns AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { POST } = await import('@/app/api/identity/sessions/route');
    const res = await POST(
      makeJsonRequest({
        tokenHash: 'a'.repeat(64),
        expiresAt: '2026-12-31T00:00:00.000Z',
      }),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });

  it('GET /api/identity/sessions returns AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { GET } = await import('@/app/api/identity/sessions/route');
    const res = await GET(
      new Request('http://localhost/api/identity/sessions'),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });

  it('POST revoke returns AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { POST } = await import(
      '@/app/api/identity/sessions/[sessionId]/revoke/route'
    );
    const res = await POST(
      new Request('http://localhost/api/identity/sessions/x/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });
});

// ---------------------------------------------------------------------------
// 7. Route feature-gate — enabled with dev auth
// ---------------------------------------------------------------------------

describe('Route feature-gate — enabled with dev auth', () => {
  it('POST /api/identity/sessions returns ok from mocked createSession', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';

    const { POST } = await import('@/app/api/identity/sessions/route');
    const req = makeJsonRequest(
      {
        tokenHash: 'a'.repeat(64),
        expiresAt: '2026-12-31T00:00:00.000Z',
      },
      { headers: { [DEV_AUTH_HEADERS.userId]: USER_ID } },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('GET /api/identity/sessions returns ok from mocked listUserSessions', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';

    const { GET } = await import('@/app/api/identity/sessions/route');
    const req = devRequest({ [DEV_AUTH_HEADERS.userId]: USER_ID });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('POST revoke returns ok from mocked revokeSession', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';

    const { POST } = await import(
      '@/app/api/identity/sessions/[sessionId]/revoke/route'
    );
    const req = new Request(
      'http://localhost/api/identity/sessions/' + SESSION_ID + '/revoke',
      {
        method: 'POST',
        headers: { [DEV_AUTH_HEADERS.userId]: USER_ID },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ sessionId: SESSION_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. Scope guards
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Scope guards', () => {
  const SESSIONS_ROUTE = path.join(
    PROJECT_ROOT,
    'src/app/api/identity/sessions/route.ts',
  );
  const REVOKE_ROUTE = path.join(
    PROJECT_ROOT,
    'src/app/api/identity/sessions/[sessionId]/revoke/route.ts',
  );
  const HANDLER = path.join(
    PROJECT_ROOT,
    'src/app/api/identity/sessions/handler.ts',
  );

  const FORBIDDEN_IN_ROUTE = [
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

  const FORBIDDEN_IN_HANDLER = [
    'getPrisma',
    'PrismaClient',
    'repository',
    'middleware',
    'clerk',
    'next-auth',
    'supabase',
    'jwt',
    'cookie',
    'getApiDependencies',
  ];

  it('sessions route.ts must not contain forbidden imports', () => {
    const content = fs.readFileSync(SESSIONS_ROUTE, 'utf-8');
    for (const forbidden of FORBIDDEN_IN_ROUTE) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('revoke route.ts must not contain forbidden imports', () => {
    const content = fs.readFileSync(REVOKE_ROUTE, 'utf-8');
    for (const forbidden of FORBIDDEN_IN_ROUTE) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('handler.ts must not contain forbidden imports', () => {
    const content = fs.readFileSync(HANDLER, 'utf-8');
    for (const forbidden of FORBIDDEN_IN_HANDLER) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('non-session placeholder routes remain unchanged', () => {
    const placeholderRoutes = [
      'src/app/api/identity/users/[userId]/route.ts',
    ];

    for (const routePath of placeholderRoutes) {
      const fullPath = path.join(PROJECT_ROOT, routePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).toContain('createPlaceholderRoute');
      expect(content).not.toContain('identity/sessions/handler');
    }
  });
});
