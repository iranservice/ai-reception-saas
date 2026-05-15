// ===========================================================================
// Tests — Auth.js Request-Context Adapter (TASK-0039)
//
// Verifies Auth.js-backed authenticated request-context resolver,
// feature flag gating, session shape handling, and deferred tenant/system
// resolution. No server startup, DB, or real Auth.js required.
// ===========================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG,
  isAuthjsRequestContextEnabled,
  createAuthjsRequestContextAdapter,
  createDefaultAuthjsAdapter,
  AUTHJS_RUNTIME_NOT_ENABLED_MESSAGE,
  AUTHJS_SESSION_MISSING_USER_ID_MESSAGE,
  AUTHJS_TENANT_CONTEXT_UNAVAILABLE_MESSAGE,
  AUTHJS_SYSTEM_CONTEXT_UNAVAILABLE_MESSAGE,
  type AuthjsSessionLike,
  type AuthjsSessionReader,
  type AuthjsRequestContextAdapterOptions,
} from '@/app/api/_shared/authjs-context-adapter';

import {
  getAuthjsAuth,
  setAuthjsAuth,
  resetAuthjsAuthForTests,
} from '@/lib/auth/authjs-runtime';

import { AUTHJS_RUNTIME_FEATURE_FLAG } from '@/lib/auth/authjs-feature-gate';

// ---------------------------------------------------------------------------
// Env save/restore
// ---------------------------------------------------------------------------

let prevRequestContext: string | undefined;
let prevRuntime: string | undefined;

beforeEach(() => {
  prevRequestContext = process.env[AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG];
  prevRuntime = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
  delete process.env[AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG];
  delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
  resetAuthjsAuthForTests();
});

afterEach(() => {
  if (prevRequestContext !== undefined) {
    process.env[AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG] = prevRequestContext;
  } else {
    delete process.env[AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG];
  }
  if (prevRuntime !== undefined) {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = prevRuntime;
  } else {
    delete process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
  }
  resetAuthjsAuthForTests();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  headers: Record<string, string> = {},
  url = 'http://localhost/api/test',
): Request {
  return new Request(url, { headers });
}

function mockAuth(session: AuthjsSessionLike | null): AuthjsSessionReader {
  return vi.fn(async () => session);
}

function adapterWithEnv(
  auth: AuthjsSessionReader,
  env: Record<string, string | undefined>,
) {
  return createAuthjsRequestContextAdapter({ auth, env });
}

// ---------------------------------------------------------------------------
// 1. Feature flag gate
// ---------------------------------------------------------------------------

describe('isAuthjsRequestContextEnabled', () => {
  it('returns false when env is empty', () => {
    expect(isAuthjsRequestContextEnabled({})).toBe(false);
  });

  it('returns true only for exact "true"', () => {
    expect(
      isAuthjsRequestContextEnabled({
        [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: 'true',
      }),
    ).toBe(true);
  });

  it('returns false for "TRUE", "1", "yes", "on", ""', () => {
    for (const value of ['TRUE', '1', 'yes', 'on', '']) {
      expect(
        isAuthjsRequestContextEnabled({
          [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: value,
        }),
      ).toBe(false);
    }
  });

  it('reads from process.env by default', () => {
    process.env[AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG] = 'true';
    expect(isAuthjsRequestContextEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. resolveAuthenticated — Auth.js runtime disabled
// ---------------------------------------------------------------------------

describe('createAuthjsRequestContextAdapter — resolveAuthenticated — runtime disabled', () => {
  it('returns 501 AUTH_CONTEXT_UNAVAILABLE when Auth.js runtime is not enabled', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_RUNTIME_FEATURE_FLAG]: undefined,
    });

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
      expect(body.error.message).toBe(AUTHJS_RUNTIME_NOT_ENABLED_MESSAGE);
    }
  });

  it('does not call auth() when runtime is disabled', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, {});

    await adapter.resolveAuthenticated(makeRequest());
    expect(auth).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. resolveAuthenticated — no session
// ---------------------------------------------------------------------------

describe('createAuthjsRequestContextAdapter — resolveAuthenticated — no session', () => {
  const runtimeEnv = { [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true' };

  it('returns 401 UNAUTHENTICATED when auth returns null', async () => {
    const auth = mockAuth(null);
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('returns 401 UNAUTHENTICATED when session has no user', async () => {
    const auth = mockAuth({ user: null });
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('returns 401 UNAUTHENTICATED when session has undefined user', async () => {
    const auth = mockAuth({});
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. resolveAuthenticated — valid session
// ---------------------------------------------------------------------------

describe('createAuthjsRequestContextAdapter — resolveAuthenticated — valid session', () => {
  const runtimeEnv = { [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true' };

  it('returns AuthenticatedUserRequestContext with user.id', async () => {
    const auth = mockAuth({ user: { id: 'internal-user-uuid-001' } });
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('user');
      expect(result.context.userId).toBe('internal-user-uuid-001');
      expect(result.context.businessId).toBeNull();
      expect(result.context.membershipId).toBeNull();
      expect(result.context.role).toBeNull();
    }
  });

  it('populates requestId from x-request-id header', async () => {
    const auth = mockAuth({ user: { id: 'user-req-id' } });
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(
      makeRequest({ 'x-request-id': 'req-abc-123' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.requestId).toBe('req-abc-123');
    }
  });

  it('requestId is null when x-request-id header is absent', async () => {
    const auth = mockAuth({ user: { id: 'user-no-req-id' } });
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.requestId).toBeNull();
    }
  });

  it('passes request to auth function', async () => {
    const auth = vi.fn(async () => ({ user: { id: 'user-pass-req' } }));
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const req = makeRequest();
    await adapter.resolveAuthenticated(req);
    expect(auth).toHaveBeenCalledWith(req);
  });
});

// ---------------------------------------------------------------------------
// 5. resolveAuthenticated — invalid session (missing user.id)
// ---------------------------------------------------------------------------

describe('createAuthjsRequestContextAdapter — resolveAuthenticated — missing user.id', () => {
  const runtimeEnv = { [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true' };

  it('returns 400 INVALID_AUTH_CONTEXT when user.id is undefined', async () => {
    const auth = mockAuth({ user: { email: 'test@example.com' } });
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_AUTH_CONTEXT');
      expect(body.error.message).toBe(AUTHJS_SESSION_MISSING_USER_ID_MESSAGE);
    }
  });

  it('returns 400 INVALID_AUTH_CONTEXT when user.id is null', async () => {
    const auth = mockAuth({ user: { id: null } });
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_AUTH_CONTEXT');
    }
  });

  it('returns 400 INVALID_AUTH_CONTEXT when user.id is empty string', async () => {
    const auth = mockAuth({ user: { id: '' } });
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('returns 400 INVALID_AUTH_CONTEXT when user.id is whitespace-only', async () => {
    const auth = mockAuth({ user: { id: '   ' } });
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('email must not be used as userId — session with email but no id fails', async () => {
    const auth = mockAuth({
      user: {
        email: 'user@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
      },
    });
    const adapter = adapterWithEnv(auth, runtimeEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_AUTH_CONTEXT');
    }
  });
});

// ---------------------------------------------------------------------------
// 6. resolveTenant — always unavailable
// ---------------------------------------------------------------------------

describe('createAuthjsRequestContextAdapter — resolveTenant', () => {
  it('always returns 501 AUTH_CONTEXT_UNAVAILABLE', async () => {
    const auth = mockAuth({ user: { id: 'user-tenant' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
    });

    const result = await adapter.resolveTenant(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
      expect(body.error.message).toBe(AUTHJS_TENANT_CONTEXT_UNAVAILABLE_MESSAGE);
    }
  });

  it('does not call auth when resolveTenant is called', async () => {
    const auth = mockAuth({ user: { id: 'user-tenant' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
    });

    await adapter.resolveTenant(makeRequest());
    expect(auth).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. resolveSystem — always unavailable
// ---------------------------------------------------------------------------

describe('createAuthjsRequestContextAdapter — resolveSystem', () => {
  it('always returns 501 AUTH_CONTEXT_UNAVAILABLE', async () => {
    const auth = mockAuth({ user: { id: 'user-system' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
    });

    const result = await adapter.resolveSystem(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
      expect(body.error.message).toBe(AUTHJS_SYSTEM_CONTEXT_UNAVAILABLE_MESSAGE);
    }
  });

  it('does not call auth when resolveSystem is called', async () => {
    const auth = mockAuth({ user: { id: 'user-system' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
    });

    await adapter.resolveSystem(makeRequest());
    expect(auth).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 8. authjs-runtime.ts — getAuthjsAuth / setAuthjsAuth / reset
// ---------------------------------------------------------------------------

describe('authjs-runtime — getAuthjsAuth / setAuthjsAuth', () => {
  it('getAuthjsAuth returns null before setAuthjsAuth is called', () => {
    expect(getAuthjsAuth()).toBeNull();
  });

  it('setAuthjsAuth registers the auth function', () => {
    const mockFn = vi.fn();
    setAuthjsAuth(mockFn);
    expect(getAuthjsAuth()).toBe(mockFn);
  });

  it('resetAuthjsAuthForTests resets to null', () => {
    const mockFn = vi.fn();
    setAuthjsAuth(mockFn);
    expect(getAuthjsAuth()).toBe(mockFn);
    resetAuthjsAuthForTests();
    expect(getAuthjsAuth()).toBeNull();
  });

  it('setAuthjsAuth overwrites on subsequent calls', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    setAuthjsAuth(fn1);
    expect(getAuthjsAuth()).toBe(fn1);
    setAuthjsAuth(fn2);
    expect(getAuthjsAuth()).toBe(fn2);
  });
});

// ---------------------------------------------------------------------------
// 9. createDefaultAuthjsAdapter — wired with runtime singleton
// ---------------------------------------------------------------------------

describe('createDefaultAuthjsAdapter', () => {
  it('returns an adapter with all three resolver methods', () => {
    const adapter = createDefaultAuthjsAdapter();
    expect(typeof adapter.resolveAuthenticated).toBe('function');
    expect(typeof adapter.resolveTenant).toBe('function');
    expect(typeof adapter.resolveSystem).toBe('function');
  });

  it('resolveAuthenticated returns 401 when no auth is registered', async () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    const adapter = createDefaultAuthjsAdapter();

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // auth returns null (no function registered) → UNAUTHENTICATED
      expect(result.response.status).toBe(401);
    }
  });

  it('resolveAuthenticated works with registered auth function', async () => {
    process.env[AUTHJS_RUNTIME_FEATURE_FLAG] = 'true';
    setAuthjsAuth(async () => ({ user: { id: 'default-adapter-user' } }));
    const adapter = createDefaultAuthjsAdapter();

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.userId).toBe('default-adapter-user');
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Scope guards
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('TASK-0039 scope guards', () => {
  const AUTHJS_CONTEXT_ADAPTER_PATH = path.join(
    PROJECT_ROOT,
    'src/app/api/_shared/authjs-context-adapter.ts',
  );
  const AUTH_CONTEXT_ADAPTER_PATH = path.join(
    PROJECT_ROOT,
    'src/app/api/_shared/auth-context-adapter.ts',
  );
  const AUTHJS_RUNTIME_PATH = path.join(
    PROJECT_ROOT,
    'src/lib/auth/authjs-runtime.ts',
  );

  it('authjs-context-adapter.ts does not import next-auth directly', () => {
    const content = fs.readFileSync(AUTHJS_CONTEXT_ADAPTER_PATH, 'utf-8');
    // Strip comments to avoid false positives from doc comments
    const codeOnly = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(codeOnly).not.toContain("from 'next-auth");
    expect(codeOnly).not.toContain('from "next-auth');
  });

  it('authjs-context-adapter.ts does not import forbidden modules', () => {
    const content = fs.readFileSync(AUTHJS_CONTEXT_ADAPTER_PATH, 'utf-8');
    const codeOnly = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    const forbidden = [
      'getPrisma',
      'PrismaClient',
      'repository',
      'middleware',
      'cookie',
    ];
    for (const f of forbidden) {
      expect(codeOnly).not.toContain(f);
    }
  });

  it('auth-context-adapter.ts scope guard still passes — no next-auth import', () => {
    const content = fs.readFileSync(AUTH_CONTEXT_ADAPTER_PATH, 'utf-8');
    // The existing scope guard checks for these strings in the source
    const forbidden = [
      'next-auth',
      'jwt',
      'cookie',
    ];
    for (const f of forbidden) {
      expect(content).not.toContain(f);
    }
  });

  it('authjs-runtime.ts does not import next-auth directly', () => {
    const content = fs.readFileSync(AUTHJS_RUNTIME_PATH, 'utf-8');
    const codeOnly = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
    expect(codeOnly).not.toContain("from 'next-auth");
    expect(codeOnly).not.toContain('from "next-auth');
  });

  it('no middleware.ts was added', () => {
    expect(
      fs.existsSync(path.join(PROJECT_ROOT, 'src/middleware.ts')),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(PROJECT_ROOT, 'middleware.ts')),
    ).toBe(false);
  });

  it('prisma/schema.prisma was not changed for TASK-0039', () => {
    const schema = fs.readFileSync(
      path.join(PROJECT_ROOT, 'prisma/schema.prisma'),
      'utf-8',
    );
    expect(schema).not.toContain('TASK-0039');
  });

  it('no migration files were added for TASK-0039', () => {
    const migrationsDir = path.join(PROJECT_ROOT, 'prisma/migrations');
    const dirs = fs.readdirSync(migrationsDir).filter(
      (d) => d.includes('0039'),
    );
    expect(dirs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 11. Feature flag constants
// ---------------------------------------------------------------------------

describe('TASK-0039 constants', () => {
  it('AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG is ENABLE_AUTHJS_REQUEST_CONTEXT', () => {
    expect(AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG).toBe(
      'ENABLE_AUTHJS_REQUEST_CONTEXT',
    );
  });

  it('error messages are non-empty strings', () => {
    expect(AUTHJS_RUNTIME_NOT_ENABLED_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_SESSION_MISSING_USER_ID_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_TENANT_CONTEXT_UNAVAILABLE_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_SYSTEM_CONTEXT_UNAVAILABLE_MESSAGE.length).toBeGreaterThan(0);
  });
});
