// ===========================================================================
// Tests — Auth Context Adapter
//
// Verifies dev header auth context adapter, env gate, principal parsers,
// resolver integration, identity/me integration, and scope guards.
// No server startup, DB, or auth required.
// ===========================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  areDevAuthHeadersEnabled,
  DEV_AUTH_CONTEXT_FEATURE_FLAG,
  DEV_AUTH_HEADERS,
  readHeader,
  authContextUnavailable,
  invalidAuthContext,
  parseDevAuthenticatedPrincipal,
  parseDevTenantPrincipal,
  parseDevSystemPrincipal,
  createDevHeaderAuthContextAdapter,
  getDefaultAuthContextAdapter,
} from '@/app/api/_shared/auth-context-adapter';

import {
  resolveAuthenticatedRequestContext,
  resolveTenantRequestContext,
  resolveSystemRequestContext,
} from '@/app/api/_shared/request-context';

import { API_HANDLERS_FEATURE_FLAG } from '@/app/api/_shared/feature-gate';
import { makeJsonRequest } from '@/app/api/_shared/request';
import { ok } from '@/lib/result';
import type { UserIdentity } from '@/domains/identity/types';

// Mock composition to avoid Prisma/DATABASE_URL initialization
vi.mock('@/app/api/_shared/composition', () => {
  const mockUser: UserIdentity = {
    id: 'user-dev-001',
    email: 'dev@example.com',
    name: 'Dev User',
    locale: 'en',
    status: 'ACTIVE',
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  return {
    getApiDependencies: () => ({
      services: {
        identity: {
          findUserById: vi.fn().mockResolvedValue(ok(mockUser)),
          updateUser: vi.fn().mockResolvedValue(
            ok({ ...mockUser, name: 'Updated Dev' }),
          ),
        },
      },
    }),
  };
});

// ---------------------------------------------------------------------------
// Env save/restore
// ---------------------------------------------------------------------------

let prevDevAuth: string | undefined;
let prevApiHandlers: string | undefined;

beforeEach(() => {
  prevDevAuth = process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
  prevApiHandlers = process.env[API_HANDLERS_FEATURE_FLAG];
  delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
  delete process.env[API_HANDLERS_FEATURE_FLAG];
});

afterEach(() => {
  if (prevDevAuth !== undefined) {
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = prevDevAuth;
  } else {
    delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG];
  }
  if (prevApiHandlers !== undefined) {
    process.env[API_HANDLERS_FEATURE_FLAG] = prevApiHandlers;
  } else {
    delete process.env[API_HANDLERS_FEATURE_FLAG];
  }
});

// ---------------------------------------------------------------------------
// Helper to create request with dev headers
// ---------------------------------------------------------------------------

function devRequest(
  headers: Record<string, string>,
  url = 'http://localhost/api/identity/me',
): Request {
  return new Request(url, { headers });
}

// ---------------------------------------------------------------------------
// 1. Env gate
// ---------------------------------------------------------------------------

describe('areDevAuthHeadersEnabled', () => {
  it('returns false when env missing', () => {
    expect(areDevAuthHeadersEnabled({})).toBe(false);
  });

  it('returns true only for exact "true"', () => {
    expect(
      areDevAuthHeadersEnabled({ [DEV_AUTH_CONTEXT_FEATURE_FLAG]: 'true' }),
    ).toBe(true);
  });

  it('returns false for "TRUE", "1", "yes", "on", ""', () => {
    expect(
      areDevAuthHeadersEnabled({ [DEV_AUTH_CONTEXT_FEATURE_FLAG]: 'TRUE' }),
    ).toBe(false);
    expect(
      areDevAuthHeadersEnabled({ [DEV_AUTH_CONTEXT_FEATURE_FLAG]: '1' }),
    ).toBe(false);
    expect(
      areDevAuthHeadersEnabled({ [DEV_AUTH_CONTEXT_FEATURE_FLAG]: 'yes' }),
    ).toBe(false);
    expect(
      areDevAuthHeadersEnabled({ [DEV_AUTH_CONTEXT_FEATURE_FLAG]: 'on' }),
    ).toBe(false);
    expect(
      areDevAuthHeadersEnabled({ [DEV_AUTH_CONTEXT_FEATURE_FLAG]: '' }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Header reading
// ---------------------------------------------------------------------------

describe('readHeader', () => {
  it('trims header values', () => {
    const req = devRequest({ 'x-dev-user-id': '  user-123  ' });
    expect(readHeader(req, 'x-dev-user-id')).toBe('user-123');
  });

  it('returns null for missing or blank header', () => {
    const req = devRequest({});
    expect(readHeader(req, 'x-dev-user-id')).toBeNull();

    const req2 = devRequest({ 'x-dev-user-id': '   ' });
    expect(readHeader(req2, 'x-dev-user-id')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Helper results
// ---------------------------------------------------------------------------

describe('authContextUnavailable', () => {
  it('returns 501 AUTH_CONTEXT_UNAVAILABLE', async () => {
    const result = authContextUnavailable();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
  });
});

describe('invalidAuthContext', () => {
  it('returns 400 INVALID_AUTH_CONTEXT', async () => {
    const result = invalidAuthContext('Bad role');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_AUTH_CONTEXT');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Principal parsers
// ---------------------------------------------------------------------------

describe('parseDevAuthenticatedPrincipal', () => {
  it('returns userId from x-dev-user-id', () => {
    const req = devRequest({ [DEV_AUTH_HEADERS.userId]: 'user-abc' });
    const result = parseDevAuthenticatedPrincipal(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.userId).toBe('user-abc');
    }
  });

  it('returns AUTH_CONTEXT_UNAVAILABLE when user id missing', async () => {
    const req = devRequest({});
    const result = parseDevAuthenticatedPrincipal(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
  });
});

describe('parseDevTenantPrincipal', () => {
  it('returns userId/businessId/membershipId/role', () => {
    const req = devRequest({
      [DEV_AUTH_HEADERS.userId]: 'user-t1',
      [DEV_AUTH_HEADERS.businessId]: 'biz-t1',
      [DEV_AUTH_HEADERS.membershipId]: 'mem-t1',
      [DEV_AUTH_HEADERS.role]: 'ADMIN',
    });
    const result = parseDevTenantPrincipal(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.userId).toBe('user-t1');
      expect(result.context.businessId).toBe('biz-t1');
      expect(result.context.membershipId).toBe('mem-t1');
      expect(result.context.role).toBe('ADMIN');
    }
  });

  it('returns AUTH_CONTEXT_UNAVAILABLE when required tenant header missing', async () => {
    // Missing businessId
    const req = devRequest({
      [DEV_AUTH_HEADERS.userId]: 'user-t1',
      [DEV_AUTH_HEADERS.membershipId]: 'mem-t1',
      [DEV_AUTH_HEADERS.role]: 'ADMIN',
    });
    const result = parseDevTenantPrincipal(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
  });

  it('returns INVALID_AUTH_CONTEXT for invalid role', async () => {
    const req = devRequest({
      [DEV_AUTH_HEADERS.userId]: 'user-t1',
      [DEV_AUTH_HEADERS.businessId]: 'biz-t1',
      [DEV_AUTH_HEADERS.membershipId]: 'mem-t1',
      [DEV_AUTH_HEADERS.role]: 'SUPERADMIN',
    });
    const result = parseDevTenantPrincipal(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_AUTH_CONTEXT');
    }
  });
});

describe('parseDevSystemPrincipal', () => {
  it('returns system principal when x-dev-system is "true"', () => {
    const req = devRequest({
      [DEV_AUTH_HEADERS.system]: 'true',
      [DEV_AUTH_HEADERS.businessId]: 'biz-sys',
    });
    const result = parseDevSystemPrincipal(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.businessId).toBe('biz-sys');
    }
  });

  it('returns system principal with null businessId when omitted', () => {
    const req = devRequest({ [DEV_AUTH_HEADERS.system]: 'true' });
    const result = parseDevSystemPrincipal(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.businessId).toBeNull();
    }
  });

  it('returns AUTH_CONTEXT_UNAVAILABLE when x-dev-system is missing or not "true"', async () => {
    const req1 = devRequest({});
    const result1 = parseDevSystemPrincipal(req1);
    expect(result1.ok).toBe(false);
    if (!result1.ok) {
      expect(result1.response.status).toBe(501);
    }

    const req2 = devRequest({ [DEV_AUTH_HEADERS.system]: 'yes' });
    const result2 = parseDevSystemPrincipal(req2);
    expect(result2.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Adapter factory
// ---------------------------------------------------------------------------

describe('createDevHeaderAuthContextAdapter', () => {
  it('resolveAuthenticated returns AUTH_CONTEXT_UNAVAILABLE when env disabled', async () => {
    const adapter = createDevHeaderAuthContextAdapter({ env: {} });
    const req = devRequest({ [DEV_AUTH_HEADERS.userId]: 'user-1' });
    const result = await adapter.resolveAuthenticated(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
  });

  it('resolveAuthenticated returns authenticated context when env enabled and header exists', async () => {
    const adapter = createDevHeaderAuthContextAdapter({
      env: { [DEV_AUTH_CONTEXT_FEATURE_FLAG]: 'true' },
    });
    const req = devRequest({
      [DEV_AUTH_HEADERS.userId]: 'user-dev-1',
      'x-request-id': 'req-123',
    });
    const result = await adapter.resolveAuthenticated(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('user');
      expect(result.context.userId).toBe('user-dev-1');
      expect(result.context.requestId).toBe('req-123');
      expect(result.context.businessId).toBeNull();
    }
  });

  it('resolveTenant returns tenant context when env enabled and headers exist', async () => {
    const adapter = createDevHeaderAuthContextAdapter({
      env: { [DEV_AUTH_CONTEXT_FEATURE_FLAG]: 'true' },
    });
    const req = devRequest({
      [DEV_AUTH_HEADERS.userId]: 'user-t',
      [DEV_AUTH_HEADERS.businessId]: 'biz-t',
      [DEV_AUTH_HEADERS.membershipId]: 'mem-t',
      [DEV_AUTH_HEADERS.role]: 'OWNER',
    });
    const result = await adapter.resolveTenant(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('user');
      expect(result.context.userId).toBe('user-t');
      expect(result.context.businessId).toBe('biz-t');
      expect(result.context.membershipId).toBe('mem-t');
      expect(result.context.role).toBe('OWNER');
    }
  });

  it('resolveSystem returns system context when env enabled and x-dev-system is true', async () => {
    const adapter = createDevHeaderAuthContextAdapter({
      env: { [DEV_AUTH_CONTEXT_FEATURE_FLAG]: 'true' },
    });
    const req = devRequest({
      [DEV_AUTH_HEADERS.system]: 'true',
      [DEV_AUTH_HEADERS.businessId]: 'biz-sys',
    });
    const result = await adapter.resolveSystem(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('system');
      expect(result.context.businessId).toBe('biz-sys');
      expect(result.context.userId).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// 6. getDefaultAuthContextAdapter
// ---------------------------------------------------------------------------

describe('getDefaultAuthContextAdapter', () => {
  it('returns an adapter with resolveAuthenticated/resolveTenant/resolveSystem', () => {
    const adapter = getDefaultAuthContextAdapter();
    expect(typeof adapter.resolveAuthenticated).toBe('function');
    expect(typeof adapter.resolveTenant).toBe('function');
    expect(typeof adapter.resolveSystem).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 7. request-context resolver integration — default behavior
// ---------------------------------------------------------------------------

describe('request-context resolver integration — default behavior', () => {
  it('resolveAuthenticatedRequestContext returns AUTH_CONTEXT_UNAVAILABLE by default', async () => {
    const req = new Request('http://localhost/test');
    const result = await resolveAuthenticatedRequestContext(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
  });

  it('resolveTenantRequestContext returns AUTH_CONTEXT_UNAVAILABLE by default', async () => {
    const req = new Request('http://localhost/test');
    const result = await resolveTenantRequestContext(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
  });

  it('resolveSystemRequestContext returns AUTH_CONTEXT_UNAVAILABLE by default', async () => {
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
// 8. request-context resolver integration — dev auth enabled
// ---------------------------------------------------------------------------

describe('request-context resolver integration — dev auth enabled', () => {
  it('resolveAuthenticatedRequestContext returns authenticated context when enabled', async () => {
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const req = devRequest({ [DEV_AUTH_HEADERS.userId]: 'user-rc-1' });
    const result = await resolveAuthenticatedRequestContext(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('user');
      expect(result.context.userId).toBe('user-rc-1');
    }
  });

  it('resolveTenantRequestContext returns tenant context when enabled', async () => {
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const req = devRequest({
      [DEV_AUTH_HEADERS.userId]: 'user-rc-t',
      [DEV_AUTH_HEADERS.businessId]: 'biz-rc-t',
      [DEV_AUTH_HEADERS.membershipId]: 'mem-rc-t',
      [DEV_AUTH_HEADERS.role]: 'OPERATOR',
    });
    const result = await resolveTenantRequestContext(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('user');
      expect(result.context.userId).toBe('user-rc-t');
      expect(result.context.businessId).toBe('biz-rc-t');
      expect(result.context.role).toBe('OPERATOR');
    }
  });

  it('resolveSystemRequestContext returns system context when enabled', async () => {
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const req = devRequest({ [DEV_AUTH_HEADERS.system]: 'true' });
    const result = await resolveSystemRequestContext(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('system');
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Identity/me integration — dev auth with mocked services
// ---------------------------------------------------------------------------

describe('Identity/me integration with dev auth', () => {
  it('GET /api/identity/me calls mocked identity service with dev auth', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';

    const { GET } = await import('@/app/api/identity/me/route');
    const req = devRequest({ [DEV_AUTH_HEADERS.userId]: 'user-dev-001' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe('user-dev-001');
  });

  it('PATCH /api/identity/me calls mocked updateUser with dev auth', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';

    const { PATCH } = await import('@/app/api/identity/me/route');
    const req = makeJsonRequest(
      { name: 'Updated Dev' },
      {
        method: 'PATCH',
        headers: { [DEV_AUTH_HEADERS.userId]: 'user-dev-001' },
      },
    );
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe('Updated Dev');
  });
});

// ---------------------------------------------------------------------------
// 10. Scope guards
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Scope guards', () => {
  const ADAPTER_PATH = path.join(
    PROJECT_ROOT,
    'src/app/api/_shared/auth-context-adapter.ts',
  );
  const CONTEXT_PATH = path.join(
    PROJECT_ROOT,
    'src/app/api/_shared/request-context.ts',
  );

  const FORBIDDEN = [
    'getApiDependencies',
    'getPrisma',
    'PrismaClient',
    'repository',
    'implementation',
    'middleware',
    'clerk',
    'next-auth',
    'supabase',
    'jwt',
    'cookie',
  ];

  it('auth-context-adapter.ts must not contain forbidden imports', () => {
    const content = fs.readFileSync(ADAPTER_PATH, 'utf-8');
    for (const forbidden of FORBIDDEN) {
      expect(content).not.toContain(forbidden);
    }
  });

  it('request-context.ts must not contain forbidden imports', () => {
    const content = fs.readFileSync(CONTEXT_PATH, 'utf-8');
    for (const forbidden of FORBIDDEN) {
      expect(content).not.toContain(forbidden);
    }
  });
});
