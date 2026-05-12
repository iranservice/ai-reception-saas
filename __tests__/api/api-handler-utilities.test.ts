// ===========================================================================
// Tests — API Handler Utilities
//
// Verifies ActionResult converters, request body helpers, route param/query
// helpers, handler boundaries, and route skeleton isolation.
// No server startup or DB required.
// ===========================================================================

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

import { ok, err } from '@/lib/result';

import {
  actionResultToResponse,
  actionResultToResponseWithStatus,
} from '@/app/api/_shared/action-result';

import {
  readJsonBody,
  validateJsonBody,
  readOptionalJsonBody,
  makeJsonRequest,
} from '@/app/api/_shared/request';

import {
  validateRouteParams,
  parseBooleanQueryParam,
  parseIntegerQueryParam,
  getSearchParam,
  uuidParamSchema,
} from '@/app/api/_shared/params';

import {
  withApiErrorBoundary,
  notImplementedHandler,
} from '@/app/api/_shared/handler';

// ---------------------------------------------------------------------------
// 1. ActionResult response helpers
// ---------------------------------------------------------------------------

describe('actionResultToResponse', () => {
  it('converts ok result to 200 response', async () => {
    const result = ok({ id: 'abc' });
    const res = actionResultToResponse(result);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { id: 'abc' } });
  });

  it('converts err USER_NOT_FOUND to 404 response', async () => {
    const result = err('USER_NOT_FOUND', 'User not found');
    const res = actionResultToResponse(result);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    });
  });

  it('converts unknown error code to 500 response', async () => {
    const result = err('TOTALLY_UNKNOWN', 'Something broke');
    const res = actionResultToResponse(result);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('TOTALLY_UNKNOWN');
  });
});

describe('actionResultToResponseWithStatus', () => {
  it('converts ok result to custom success status', async () => {
    const result = ok({ created: true });
    const res = actionResultToResponseWithStatus(result, 201);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { created: true } });
  });

  it('converts err to mapped status regardless of custom success', async () => {
    const result = err('ACCESS_DENIED', 'No access');
    const res = actionResultToResponseWithStatus(result, 201);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ACCESS_DENIED');
  });
});

// ---------------------------------------------------------------------------
// 2. Request body helpers
// ---------------------------------------------------------------------------

describe('readJsonBody', () => {
  it('parses valid JSON', async () => {
    const req = makeJsonRequest({ name: 'Test' });
    const result = await readJsonBody(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: 'Test' });
    }
  });

  it('returns INVALID_JSON_BODY for invalid JSON', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'content-type': 'application/json' },
    });
    const result = await readJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_JSON_BODY');
    }
  });
});

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

describe('validateJsonBody', () => {
  it('returns parsed data for valid schema', async () => {
    const req = makeJsonRequest({ name: 'Alice', age: 30 });
    const result = await validateJsonBody(
      req,
      testSchema,
      'INVALID_TEST_INPUT',
      'Invalid test input',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('returns supplied invalid code/message for validation failure', async () => {
    const req = makeJsonRequest({ name: '', age: -1 });
    const result = await validateJsonBody(
      req,
      testSchema,
      'INVALID_TEST_INPUT',
      'Invalid test input',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_TEST_INPUT');
      expect(body.error.message).toBe('Invalid test input');
    }
  });
});

describe('readOptionalJsonBody', () => {
  it('returns undefined for empty body', async () => {
    const req = new Request('http://localhost/test', {
      method: 'PATCH',
    });
    const result = await readOptionalJsonBody(
      req,
      testSchema,
      'INVALID_TEST_INPUT',
      'Invalid test input',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeUndefined();
    }
  });

  it('validates body when present', async () => {
    const req = makeJsonRequest({ name: 'Bob', age: 25 });
    const result = await readOptionalJsonBody(
      req,
      testSchema,
      'INVALID_TEST_INPUT',
      'Invalid test input',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: 'Bob', age: 25 });
    }
  });

  it('returns error for invalid body when present', async () => {
    const req = new Request('http://localhost/test', {
      method: 'PATCH',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    });
    const result = await readOptionalJsonBody(
      req,
      testSchema,
      'INVALID_TEST_INPUT',
      'Invalid test input',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_JSON_BODY');
    }
  });
});

describe('makeJsonRequest', () => {
  it('creates JSON request with content-type', () => {
    const req = makeJsonRequest({ test: true });
    expect(req.method).toBe('POST');
    expect(req.headers.get('content-type')).toBe('application/json');
    expect(req.url).toBe('http://localhost/test');
  });

  it('merges custom headers', () => {
    const req = makeJsonRequest(
      { test: true },
      { headers: { 'x-custom': 'value' } },
    );
    expect(req.headers.get('content-type')).toBe('application/json');
    expect(req.headers.get('x-custom')).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// 3. Params and query helpers
// ---------------------------------------------------------------------------

const uuidSchema = z.object({ userId: z.string().uuid() });

describe('validateRouteParams', () => {
  it('returns parsed route params', () => {
    const result = validateRouteParams(
      { userId: '550e8400-e29b-41d4-a716-446655440000' },
      uuidSchema,
      'INVALID_IDENTITY_INPUT',
      'Invalid identity input',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    }
  });

  it('returns error response on invalid UUID', async () => {
    const result = validateRouteParams(
      { userId: 'not-a-uuid' },
      uuidSchema,
      'INVALID_IDENTITY_INPUT',
      'Invalid identity input',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_IDENTITY_INPUT');
    }
  });
});

describe('parseBooleanQueryParam', () => {
  it('parses true/false/null', () => {
    expect(parseBooleanQueryParam('true')).toBe(true);
    expect(parseBooleanQueryParam('false')).toBe(false);
    expect(parseBooleanQueryParam(null)).toBeUndefined();
  });

  it('returns undefined for invalid values', () => {
    expect(parseBooleanQueryParam('yes')).toBeUndefined();
    expect(parseBooleanQueryParam('1')).toBeUndefined();
    expect(parseBooleanQueryParam('')).toBeUndefined();
  });
});

describe('parseIntegerQueryParam', () => {
  it('parses integer strings', () => {
    expect(parseIntegerQueryParam('42')).toBe(42);
    expect(parseIntegerQueryParam('0')).toBe(0);
    expect(parseIntegerQueryParam('-5')).toBe(-5);
  });

  it('returns undefined for invalid values', () => {
    expect(parseIntegerQueryParam(null)).toBeUndefined();
    expect(parseIntegerQueryParam('abc')).toBeUndefined();
    expect(parseIntegerQueryParam('3.14')).toBeUndefined();
    expect(parseIntegerQueryParam('')).toBeUndefined();
  });
});

describe('getSearchParam', () => {
  it('reads query values', () => {
    const req = new Request('http://localhost/test?foo=bar&limit=10');
    expect(getSearchParam(req, 'foo')).toBe('bar');
    expect(getSearchParam(req, 'limit')).toBe('10');
    expect(getSearchParam(req, 'missing')).toBeNull();
  });
});

describe('uuidParamSchema', () => {
  it('validates named UUID param', () => {
    const schema = uuidParamSchema('businessId');
    const valid = schema.safeParse({
      businessId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse({ businessId: 'bad' });
    expect(invalid.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Handler boundary helpers
// ---------------------------------------------------------------------------

describe('withApiErrorBoundary', () => {
  it('returns handler response on success', async () => {
    const res = await withApiErrorBoundary(async () => {
      return new Response(JSON.stringify({ ok: true, data: 'hello' }), {
        status: 200,
      });
    });
    expect(res.status).toBe(200);
  });

  it('catches thrown errors and returns INTERNAL_SERVER_ERROR', async () => {
    const res = await withApiErrorBoundary(async () => {
      throw new Error('Unexpected failure');
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  });

  it('catches non-Error throws', async () => {
    const res = await withApiErrorBoundary(async () => {
      throw 'string error';
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('notImplementedHandler', () => {
  it('returns a function producing NOT_IMPLEMENTED response', async () => {
    const handler = notImplementedHandler('GET /api/test');
    expect(typeof handler).toBe('function');
    const res = await handler();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('GET /api/test');
  });
});

// ---------------------------------------------------------------------------
// 5. Scope guard — route skeletons unchanged
// ---------------------------------------------------------------------------

describe('Route skeletons unchanged', () => {
  it('GET /api/identity/me still returns 501 NOT_IMPLEMENTED', async () => {
    const { GET } = await import('@/app/api/identity/me/route');
    const res = await GET(new Request('http://localhost/api/identity/me'));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.ok).toBe(false);
    // When feature gate is disabled, still returns NOT_IMPLEMENTED
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /api/businesses still returns 501 NOT_IMPLEMENTED', async () => {
    const { POST } = await import('@/app/api/businesses/route');
    const res = await POST();
    expect(res.status).toBe(501);
  });
});

describe('Route file scope guard — handler utilities', () => {
  const PROJECT_ROOT_LOCAL = path.resolve(__dirname, '../..');
  // Only check placeholder route files — identity/me now legitimately imports handler utilities
  const PLACEHOLDER_ROUTE_FILES_TO_CHECK = [
    'src/app/api/businesses/route.ts',
  ];
  const FORBIDDEN_IMPORTS = [
    '_shared/handler',
    '_shared/action-result',
    '_shared/request',
    '_shared/params',
    'getApiDependencies',
  ];

  it.each(PLACEHOLDER_ROUTE_FILES_TO_CHECK)(
    'route file %s does not import handler utilities',
    (routePath) => {
      const fullPath = path.join(PROJECT_ROOT_LOCAL, routePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(content).not.toContain(forbidden);
      }
    },
  );
});
