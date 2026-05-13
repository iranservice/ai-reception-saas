// ===========================================================================
// Tests — API Route Feature Gate
//
// Verifies feature gate utility, route handler wrapper, placeholder behavior,
// route file imports/scope, and route inventory.
// No server startup, DB, or auth required.
// ===========================================================================

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock composition to avoid Prisma/DATABASE_URL initialization when
// identity/me route is tested with ENABLE_API_HANDLERS=true
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

import {
  areApiHandlersEnabled,
  API_HANDLERS_FEATURE_FLAG,
} from '@/app/api/_shared/feature-gate';

import {
  createFeatureGatedRoute,
  createPlaceholderRoute,
} from '@/app/api/_shared/route-handler';

// ---------------------------------------------------------------------------
// 1. feature-gate.ts
// ---------------------------------------------------------------------------

describe('areApiHandlersEnabled', () => {
  it('returns false when env var is missing', () => {
    expect(areApiHandlersEnabled({})).toBe(false);
  });

  it('returns true only for exact "true"', () => {
    expect(
      areApiHandlersEnabled({ [API_HANDLERS_FEATURE_FLAG]: 'true' }),
    ).toBe(true);
  });

  it('returns false for "TRUE", "1", "yes", ""', () => {
    expect(
      areApiHandlersEnabled({ [API_HANDLERS_FEATURE_FLAG]: 'TRUE' }),
    ).toBe(false);
    expect(
      areApiHandlersEnabled({ [API_HANDLERS_FEATURE_FLAG]: '1' }),
    ).toBe(false);
    expect(
      areApiHandlersEnabled({ [API_HANDLERS_FEATURE_FLAG]: 'yes' }),
    ).toBe(false);
    expect(
      areApiHandlersEnabled({ [API_HANDLERS_FEATURE_FLAG]: '' }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. route-handler.ts
// ---------------------------------------------------------------------------

describe('createFeatureGatedRoute', () => {
  it('returns NOT_IMPLEMENTED when disabled', async () => {
    const handler = vi.fn(() => new Response('ok'));
    const route = createFeatureGatedRoute({
      endpoint: 'GET /api/test',
      handler,
      env: {},
    });
    const res = await route();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('does not call handler when disabled', async () => {
    const handler = vi.fn(() => new Response('ok'));
    const route = createFeatureGatedRoute({
      endpoint: 'GET /api/test',
      handler,
      env: {},
    });
    await route();
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls handler when enabled', async () => {
    const handler = vi.fn(
      () => new Response(JSON.stringify({ ok: true, data: 'hello' })),
    );
    const route = createFeatureGatedRoute({
      endpoint: 'GET /api/test',
      handler,
      env: { [API_HANDLERS_FEATURE_FLAG]: 'true' },
    });
    const res = await route();
    expect(handler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('wraps thrown handler errors as INTERNAL_SERVER_ERROR', async () => {
    const handler = () => {
      throw new Error('unexpected');
    };
    const route = createFeatureGatedRoute({
      endpoint: 'GET /api/test',
      handler,
      env: { [API_HANDLERS_FEATURE_FLAG]: 'true' },
    });
    const res = await route();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('createPlaceholderRoute', () => {
  it('returns NOT_IMPLEMENTED when disabled', async () => {
    const prev = process.env[API_HANDLERS_FEATURE_FLAG];
    delete process.env[API_HANDLERS_FEATURE_FLAG];
    try {
      const route = createPlaceholderRoute('GET /api/placeholder');
      const res = await route();
      expect(res.status).toBe(501);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_IMPLEMENTED');
    } finally {
      if (prev !== undefined) {
        process.env[API_HANDLERS_FEATURE_FLAG] = prev;
      }
    }
  });

  it('returns NOT_IMPLEMENTED when enabled', async () => {
    const prev = process.env[API_HANDLERS_FEATURE_FLAG];
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    try {
      const route = createPlaceholderRoute('GET /api/placeholder');
      const res = await route();
      expect(res.status).toBe(501);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_IMPLEMENTED');
    } finally {
      if (prev !== undefined) {
        process.env[API_HANDLERS_FEATURE_FLAG] = prev;
      } else {
        delete process.env[API_HANDLERS_FEATURE_FLAG];
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Route files — default behavior
// ---------------------------------------------------------------------------

describe('Route files default behavior', () => {
  it('GET /api/identity/me returns NOT_IMPLEMENTED by default', async () => {
    const { GET } = await import('@/app/api/identity/me/route');
    const res = await GET(new Request('http://localhost/api/identity/me'));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('PATCH /api/identity/me returns NOT_IMPLEMENTED by default', async () => {
    const { PATCH } = await import('@/app/api/identity/me/route');
    const res = await PATCH(new Request('http://localhost/api/identity/me', { method: 'PATCH' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/businesses returns NOT_IMPLEMENTED by default', async () => {
    const { POST } = await import('@/app/api/businesses/route');
    const res = await POST(new Request('http://localhost/api/businesses', { method: 'POST' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/businesses returns NOT_IMPLEMENTED by default', async () => {
    const { GET } = await import('@/app/api/businesses/route');
    const res = await GET(new Request('http://localhost/api/businesses'));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/authz/evaluate returns NOT_IMPLEMENTED by default', async () => {
    const { POST } = await import('@/app/api/authz/evaluate/route');
    const res = await POST();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/businesses/:businessId/audit-events returns NOT_IMPLEMENTED by default', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/audit-events/route'
    );
    const res = await GET();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });
});

// ---------------------------------------------------------------------------
// 4. Route files — feature-enabled behavior (still NOT_IMPLEMENTED)
// ---------------------------------------------------------------------------

describe('Route files with ENABLE_API_HANDLERS=true', () => {
  it('GET /api/identity/me returns AUTH_CONTEXT_UNAVAILABLE when enabled', async () => {
    const prev = process.env[API_HANDLERS_FEATURE_FLAG];
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    try {
      const { GET } = await import('@/app/api/identity/me/route');
      const res = await GET(new Request('http://localhost/api/identity/me'));
      expect(res.status).toBe(501);
      const body = await res.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    } finally {
      if (prev !== undefined) {
        process.env[API_HANDLERS_FEATURE_FLAG] = prev;
      } else {
        delete process.env[API_HANDLERS_FEATURE_FLAG];
      }
    }
  });

  it('POST /api/businesses returns AUTH_CONTEXT_UNAVAILABLE when enabled', async () => {
    const prev = process.env[API_HANDLERS_FEATURE_FLAG];
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    try {
      const { POST } = await import('@/app/api/businesses/route');
      const res = await POST(new Request('http://localhost/api/businesses', { method: 'POST' }));
      expect(res.status).toBe(501);
      const body = await res.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    } finally {
      if (prev !== undefined) {
        process.env[API_HANDLERS_FEATURE_FLAG] = prev;
      } else {
        delete process.env[API_HANDLERS_FEATURE_FLAG];
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Import / scope guards
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../..');

/** Route files that still use createPlaceholderRoute (not yet wired to real handlers) */
const PLACEHOLDER_ROUTE_FILES = [
  'src/app/api/identity/users/[userId]/route.ts',
  'src/app/api/businesses/[businessId]/audit-events/route.ts',
  'src/app/api/businesses/[businessId]/audit-events/[auditEventId]/route.ts',
  'src/app/api/authz/evaluate/route.ts',
  'src/app/api/authz/require/route.ts',
  'src/app/api/authz/roles/[role]/permissions/route.ts',
];

/** All route files including those wired to real handlers */
const ALL_ROUTE_FILES = [
  'src/app/api/identity/me/route.ts',
  ...PLACEHOLDER_ROUTE_FILES,
];

describe('Placeholder route files import createPlaceholderRoute', () => {
  it.each(PLACEHOLDER_ROUTE_FILES)(
    '%s imports createPlaceholderRoute',
    (routePath) => {
      const fullPath = path.join(PROJECT_ROOT, routePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).toContain('createPlaceholderRoute');
    },
  );
});

const FORBIDDEN_IMPORTS = [
  'getApiDependencies',
  'getPrisma',
  'PrismaClient',
  "from '@/domains/",
  'repository',
  'implementation',
  "from '@/domains/identity/service'",
  "from '@/domains/tenancy/service'",
  "from '@/domains/authz/service'",
  "from '@/domains/audit/service'",
];

describe('Placeholder route files do not import forbidden modules', () => {
  it.each(PLACEHOLDER_ROUTE_FILES)(
    '%s does not import forbidden modules',
    (routePath) => {
      const fullPath = path.join(PROJECT_ROOT, routePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(content).not.toContain(forbidden);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// 6. Route inventory
// ---------------------------------------------------------------------------

describe('Route inventory', () => {
  it('all 15 route files exist', () => {
    for (const routePath of ALL_ROUTE_FILES) {
      const fullPath = path.join(PROJECT_ROOT, routePath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });
});
