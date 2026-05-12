// ===========================================================================
// Tests — Tenant Identity Route Skeletons
//
// Verifies shared API helpers, route skeleton placeholder behavior,
// and route file inventory. No server startup or DB required.
// ===========================================================================

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock composition to avoid Prisma/DATABASE_URL initialization when
// session routes are imported with ENABLE_API_HANDLERS=true
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
    },
  }),
}));

import {
  apiOk,
  apiError,
  apiNotImplemented,
} from '@/app/api/_shared/responses';
import {
  API_ERROR_STATUS_MAP,
  getHttpStatusForError,
} from '@/app/api/_shared/errors';

// ---------------------------------------------------------------------------
// Shared helpers — responses.ts
// ---------------------------------------------------------------------------

describe('apiOk', () => {
  it('returns status 200 by default with ok:true JSON', async () => {
    const res = apiOk({ foo: 'bar' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { foo: 'bar' } });
  });

  it('accepts custom status via init', async () => {
    const res = apiOk({ id: 1 }, { status: 201 });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ id: 1 });
  });
});

describe('apiError', () => {
  it('returns error envelope and status', async () => {
    const res = apiError('SOME_CODE', 'Something failed', 422);
    expect(res.status).toBe(422);
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: { code: 'SOME_CODE', message: 'Something failed' },
    });
  });
});

describe('apiNotImplemented', () => {
  it('returns status 501 and code NOT_IMPLEMENTED', async () => {
    const res = apiNotImplemented('GET /api/test');
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'GET /api/test is not implemented yet',
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Shared helpers — errors.ts
// ---------------------------------------------------------------------------

describe('getHttpStatusForError', () => {
  it.each([
    ['UNAUTHENTICATED', 401],
    ['ACCESS_DENIED', 403],
    ['TENANT_ACCESS_DENIED', 403],
    ['INVALID_IDENTITY_INPUT', 400],
    ['INVALID_TENANCY_INPUT', 400],
    ['INVALID_AUTHZ_INPUT', 400],
    ['INVALID_AUDIT_INPUT', 400],
    ['USER_NOT_FOUND', 404],
    ['SESSION_NOT_FOUND', 404],
    ['BUSINESS_NOT_FOUND', 404],
    ['MEMBERSHIP_NOT_FOUND', 404],
    ['AUDIT_EVENT_NOT_FOUND', 404],
    ['USER_EMAIL_ALREADY_EXISTS', 409],
    ['BUSINESS_SLUG_ALREADY_EXISTS', 409],
    ['MEMBERSHIP_ALREADY_EXISTS', 409],
    ['LAST_OWNER_REMOVAL_DENIED', 409],
    ['SESSION_REVOKED', 400],
    ['SESSION_EXPIRED', 400],
    ['MEMBERSHIP_INACTIVE', 400],
    ['UNKNOWN_PERMISSION', 400],
    ['IDENTITY_REPOSITORY_ERROR', 500],
    ['TENANCY_REPOSITORY_ERROR', 500],
    ['AUDIT_REPOSITORY_ERROR', 500],
    ['AUDIT_WRITE_FAILED', 500],
  ])('maps %s -> %d', (code, expected) => {
    expect(getHttpStatusForError(code)).toBe(expected);
  });

  it('returns 500 for unknown codes', () => {
    expect(getHttpStatusForError('UNKNOWN_CODE')).toBe(500);
  });

  it('has complete status map object', () => {
    expect(Object.keys(API_ERROR_STATUS_MAP).length).toBeGreaterThanOrEqual(24);
  });
});

// ---------------------------------------------------------------------------
// Route skeletons — placeholder behavior
// ---------------------------------------------------------------------------

describe('Route skeleton placeholder behavior', () => {
  it('GET /api/identity/me returns 501 NOT_IMPLEMENTED', async () => {
    const { GET } = await import('@/app/api/identity/me/route');
    const res = await GET(new Request('http://localhost/api/identity/me'));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('GET /api/identity/me');
  });

  it('PATCH /api/identity/me returns 501 NOT_IMPLEMENTED', async () => {
    const { PATCH } = await import('@/app/api/identity/me/route');
    const res = await PATCH(new Request('http://localhost/api/identity/me', { method: 'PATCH' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('PATCH /api/identity/me');
  });

  it('GET /api/identity/users/:userId returns 501 NOT_IMPLEMENTED', async () => {
    const { GET } = await import(
      '@/app/api/identity/users/[userId]/route'
    );
    const res = await GET();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/identity/sessions returns 501 NOT_IMPLEMENTED', async () => {
    const { POST } = await import('@/app/api/identity/sessions/route');
    const res = await POST(new Request('http://localhost/api/identity/sessions', { method: 'POST' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/identity/sessions returns 501 NOT_IMPLEMENTED', async () => {
    const { GET } = await import('@/app/api/identity/sessions/route');
    const res = await GET(new Request('http://localhost/api/identity/sessions'));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/identity/sessions/:sessionId/revoke returns 501 NOT_IMPLEMENTED', async () => {
    const { POST } = await import(
      '@/app/api/identity/sessions/[sessionId]/revoke/route'
    );
    const res = await POST(
      new Request('http://localhost/api/identity/sessions/x/revoke', { method: 'POST' }),
      { params: Promise.resolve({ sessionId: 'test-id' }) },
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/businesses returns 501 NOT_IMPLEMENTED', async () => {
    const { POST } = await import('@/app/api/businesses/route');
    const res = await POST();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('POST /api/businesses');
  });

  it('GET /api/businesses returns 501 NOT_IMPLEMENTED', async () => {
    const { GET } = await import('@/app/api/businesses/route');
    const res = await GET();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('GET /api/businesses');
  });

  it('GET /api/businesses/:businessId returns 501 NOT_IMPLEMENTED', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/route'
    );
    const res = await GET();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('PATCH /api/businesses/:businessId returns 501 NOT_IMPLEMENTED', async () => {
    const { PATCH } = await import(
      '@/app/api/businesses/[businessId]/route'
    );
    const res = await PATCH();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/businesses/:businessId/memberships returns 501 NOT_IMPLEMENTED', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/memberships/route'
    );
    const res = await GET();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/businesses/:businessId/memberships returns 501 NOT_IMPLEMENTED', async () => {
    const { POST } = await import(
      '@/app/api/businesses/[businessId]/memberships/route'
    );
    const res = await POST();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('PATCH memberships/:membershipId/role returns 501', async () => {
    const { PATCH } = await import(
      '@/app/api/businesses/[businessId]/memberships/[membershipId]/role/route'
    );
    const res = await PATCH();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('PATCH memberships/:membershipId/status returns 501', async () => {
    const { PATCH } = await import(
      '@/app/api/businesses/[businessId]/memberships/[membershipId]/status/route'
    );
    const res = await PATCH();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('DELETE memberships/:membershipId returns 501', async () => {
    const { DELETE } = await import(
      '@/app/api/businesses/[businessId]/memberships/[membershipId]/route'
    );
    const res = await DELETE();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/authz/evaluate returns 501 NOT_IMPLEMENTED', async () => {
    const { POST } = await import('@/app/api/authz/evaluate/route');
    const res = await POST();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('POST /api/authz/evaluate');
  });

  it('POST /api/authz/require returns 501 NOT_IMPLEMENTED', async () => {
    const { POST } = await import('@/app/api/authz/require/route');
    const res = await POST();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('POST /api/authz/require');
  });

  it('GET /api/authz/roles/:role/permissions returns 501', async () => {
    const { GET } = await import(
      '@/app/api/authz/roles/[role]/permissions/route'
    );
    const res = await GET();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/businesses/:businessId/audit-events returns 501 NOT_IMPLEMENTED', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/audit-events/route'
    );
    const res = await GET();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('GET /api/businesses/:businessId/audit-events/:auditEventId returns 501', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/audit-events/[auditEventId]/route'
    );
    const res = await GET();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });
});

// ---------------------------------------------------------------------------
// Route inventory — verify all route.ts files exist
// ---------------------------------------------------------------------------

describe('Route inventory', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '../..');
  const ROUTE_FILES = [
    'src/app/api/identity/me/route.ts',
    'src/app/api/identity/users/[userId]/route.ts',
    'src/app/api/identity/sessions/route.ts',
    'src/app/api/identity/sessions/[sessionId]/revoke/route.ts',
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

  it.each(ROUTE_FILES)('route file exists: %s', (relPath) => {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    expect(fs.existsSync(fullPath)).toBe(true);
  });

  it('has exactly 15 tenant/identity route files', () => {
    expect(ROUTE_FILES).toHaveLength(15);
  });

  it('shared helper files exist', () => {
    expect(
      fs.existsSync(path.join(PROJECT_ROOT, 'src/app/api/_shared/responses.ts')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(PROJECT_ROOT, 'src/app/api/_shared/errors.ts')),
    ).toBe(true);
  });
});
