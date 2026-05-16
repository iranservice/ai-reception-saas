// ===========================================================================
// Tests — Auth.js Request-Context Adapter (TASK-0039)
//
// Verifies Auth.js-backed authenticated request-context resolver,
// feature flag gating, session shape handling, error catching,
// trimmed userId, and deferred tenant/system resolution.
// No server startup, DB, or real Auth.js required.
// ===========================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG,
  isAuthjsRequestContextEnabled,
  createAuthjsRequestContextAdapter,
  createDefaultAuthjsAdapter,
  AUTHJS_REQUEST_CONTEXT_NOT_ENABLED_MESSAGE,
  AUTHJS_RUNTIME_NOT_ENABLED_MESSAGE,
  AUTHJS_SESSION_READ_FAILED_MESSAGE,
  AUTHJS_SESSION_MISSING_USER_ID_MESSAGE,
  AUTHJS_TENANT_CONTEXT_REQUIRED_MESSAGE,
  AUTHJS_TENANT_INVALID_BUSINESS_ID_MESSAGE,
  AUTHJS_TENANT_ACCESS_DENIED_MESSAGE,
  AUTHJS_TENANT_RESOLVER_FAILED_MESSAGE,
  AUTHJS_SYSTEM_CONTEXT_UNAVAILABLE_MESSAGE,
  BUSINESS_SCOPE_HEADER,
  type AuthjsSessionReader,
  type TenantMembershipResolver,
} from '@/app/api/_shared/authjs-context-adapter';

import type { AuthjsSessionLike } from '@/lib/auth/authjs-runtime';
import { ok, err } from '@/lib/result';
import type { TenantContext } from '@/domains/tenancy/types';

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

/** Mock tenant context for happy path */
const MOCK_TENANT: TenantContext = {
  userId: 'internal-user-uuid-001',
  businessId: 'biz-uuid-001',
  membershipId: 'mem-uuid-001',
  role: 'OWNER',
};

/** Tenant resolver that always succeeds */
function successResolver(): TenantMembershipResolver {
  return vi.fn(async () => ok(MOCK_TENANT));
}

/** Tenant resolver that returns a domain error */
function failResolver(): TenantMembershipResolver {
  return vi.fn(async () => err('MEMBERSHIP_NOT_FOUND', 'No membership'));
}

/** Tenant resolver that throws */
function throwingResolver(): TenantMembershipResolver {
  return vi.fn(async () => { throw new Error('DB connection failed'); });
}

/** Both flags enabled */
const bothFlagsEnv = {
  [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: 'true',
  [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
};

function adapterWithEnv(
  auth: AuthjsSessionReader,
  env: Record<string, string | undefined>,
  tenantMembershipResolver?: TenantMembershipResolver,
) {
  return createAuthjsRequestContextAdapter({
    auth,
    env,
    tenantMembershipResolver: tenantMembershipResolver ?? successResolver(),
  });
}

// ---------------------------------------------------------------------------
// 1. Feature flag gate — isAuthjsRequestContextEnabled
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
// 2. Blocker 4 — ENABLE_AUTHJS_REQUEST_CONTEXT not set
// ---------------------------------------------------------------------------

describe('resolveAuthenticated — ENABLE_AUTHJS_REQUEST_CONTEXT not enabled', () => {
  it('returns 501 AUTH_CONTEXT_UNAVAILABLE when ENABLE_AUTHJS_REQUEST_CONTEXT is missing', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
      // ENABLE_AUTHJS_REQUEST_CONTEXT not set
    });

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
      expect(body.error.message).toBe(AUTHJS_REQUEST_CONTEXT_NOT_ENABLED_MESSAGE);
    }
  });

  it('does not call auth() when request-context flag is disabled', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
    });

    await adapter.resolveAuthenticated(makeRequest());
    expect(auth).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. resolveAuthenticated — Auth.js runtime disabled
// ---------------------------------------------------------------------------

describe('resolveAuthenticated — Auth.js runtime disabled', () => {
  it('returns 501 AUTH_CONTEXT_UNAVAILABLE when ENABLE_AUTHJS_RUNTIME is not enabled', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: 'true',
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
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: 'true',
    });

    await adapter.resolveAuthenticated(makeRequest());
    expect(auth).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. resolveAuthenticated — no session
// ---------------------------------------------------------------------------

describe('resolveAuthenticated — no session', () => {
  it('returns 401 UNAUTHENTICATED when auth returns null', async () => {
    const auth = mockAuth(null);
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

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
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

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
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. auth(request) throws -- infrastructure unavailable 501
// ---------------------------------------------------------------------------

describe('resolveAuthenticated -- auth throws', () => {
  it('returns 501 AUTH_CONTEXT_UNAVAILABLE when auth(request) throws', async () => {
    const auth = vi.fn(async () => {
      throw new Error('Auth.js internal error');
    }) as AuthjsSessionReader;
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
      expect(body.error.message).toBe(AUTHJS_SESSION_READ_FAILED_MESSAGE);
    }
  });

  it('does not return 401 or 500 when auth throws', async () => {
    const auth = vi.fn(async () => {
      throw new TypeError('Cannot read properties of undefined');
    }) as AuthjsSessionReader;
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Must be 501 -- infrastructure unavailable
      expect(result.response.status).toBe(501);
    }
  });

  it('does not expose thrown error message in response', async () => {
    const auth = vi.fn(async () => {
      throw new Error('sensitive internal detail');
    }) as AuthjsSessionReader;
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.error.message).not.toContain('sensitive');
      expect(body.error.message).toBe(AUTHJS_SESSION_READ_FAILED_MESSAGE);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. resolveAuthenticated — valid session
// ---------------------------------------------------------------------------

describe('resolveAuthenticated — valid session', () => {
  it('returns AuthenticatedUserRequestContext with user.id', async () => {
    const auth = mockAuth({ user: { id: 'internal-user-uuid-001' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

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
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

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
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.requestId).toBeNull();
    }
  });

  it('passes request to auth function', async () => {
    const auth = vi.fn(async () => ({ user: { id: 'user-pass-req' } }));
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

    const req = makeRequest();
    await adapter.resolveAuthenticated(req);
    expect(auth).toHaveBeenCalledWith(req);
  });
});

// ---------------------------------------------------------------------------
// 7. Blocker 6 — trimmed userId
// ---------------------------------------------------------------------------

describe('resolveAuthenticated — userId trimming', () => {
  it('trims leading and trailing whitespace from user.id', async () => {
    const auth = mockAuth({ user: { id: '  user-with-spaces  ' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.userId).toBe('user-with-spaces');
    }
  });

  it('whitespace-only user.id fails with INVALID_AUTH_CONTEXT', async () => {
    const auth = mockAuth({ user: { id: '   ' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

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
// 8. resolveAuthenticated — missing user.id
// ---------------------------------------------------------------------------

describe('resolveAuthenticated — missing user.id', () => {
  it('returns 400 INVALID_AUTH_CONTEXT when user.id is undefined', async () => {
    const auth = mockAuth({ user: { email: 'test@example.com' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

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
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

    const result = await adapter.resolveAuthenticated(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('returns 400 INVALID_AUTH_CONTEXT when user.id is empty string', async () => {
    const auth = mockAuth({ user: { id: '' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

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
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

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
// 9. resolveTenant — tenant context resolution
// ---------------------------------------------------------------------------

describe('resolveTenant — flag gates', () => {
  it('returns 501 when ENABLE_AUTHJS_REQUEST_CONTEXT is disabled', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: 'false',
      [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
    });
    const result = await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'biz-1' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
    }
  });

  it('returns 501 when ENABLE_AUTHJS_RUNTIME is disabled', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, {
      [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: 'true',
      [AUTHJS_RUNTIME_FEATURE_FLAG]: 'false',
    });
    const result = await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'biz-1' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
    }
  });
});

describe('resolveTenant — unauthenticated', () => {
  it('returns 401 when session is null', async () => {
    const auth = mockAuth(null);
    const adapter = adapterWithEnv(auth, bothFlagsEnv);
    const result = await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'biz-1' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });
});

describe('resolveTenant — missing business scope', () => {
  it('returns 403 TENANT_CONTEXT_REQUIRED when no x-business-id', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);
    const result = await adapter.resolveTenant(makeRequest());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error.code).toBe('TENANT_CONTEXT_REQUIRED');
      expect(body.error.message).toBe(AUTHJS_TENANT_CONTEXT_REQUIRED_MESSAGE);
    }
  });
});

describe('resolveTenant — invalid business scope', () => {
  it('returns 400 INVALID_AUTH_CONTEXT for empty x-business-id', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);
    const result = await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: '' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error.code).toBe('INVALID_AUTH_CONTEXT');
      expect(body.error.message).toBe(AUTHJS_TENANT_INVALID_BUSINESS_ID_MESSAGE);
    }
  });

  it('returns 400 INVALID_AUTH_CONTEXT for whitespace-only x-business-id', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);
    const result = await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: '   ' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });
});

describe('resolveTenant — membership not found', () => {
  it('returns 403 ACCESS_DENIED when resolver returns error', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const resolver = failResolver();
    const adapter = adapterWithEnv(auth, bothFlagsEnv, resolver);
    const result = await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'biz-1' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error.code).toBe('ACCESS_DENIED');
      expect(body.error.message).toBe(AUTHJS_TENANT_ACCESS_DENIED_MESSAGE);
    }
  });
});

describe('resolveTenant — resolver throws', () => {
  it('returns 501 AUTH_CONTEXT_UNAVAILABLE when resolver throws', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const resolver = throwingResolver();
    const adapter = adapterWithEnv(auth, bothFlagsEnv, resolver);
    const result = await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'biz-1' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
      expect(body.error.message).toBe(AUTHJS_TENANT_RESOLVER_FAILED_MESSAGE);
    }
  });

  it('does not expose thrown error message in response', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const resolver = throwingResolver();
    const adapter = adapterWithEnv(auth, bothFlagsEnv, resolver);
    const result = await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'biz-1' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.error.message).not.toContain('DB connection');
    }
  });
});

describe('resolveTenant — valid tenant context', () => {
  it('returns TenantRequestContext on success', async () => {
    const auth = mockAuth({ user: { id: 'internal-user-uuid-001' } });
    const resolver = successResolver();
    const adapter = adapterWithEnv(auth, bothFlagsEnv, resolver);
    const result = await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'biz-uuid-001' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('user');
      expect(result.context.userId).toBe(MOCK_TENANT.userId);
      expect(result.context.businessId).toBe(MOCK_TENANT.businessId);
      expect(result.context.membershipId).toBe(MOCK_TENANT.membershipId);
      expect(result.context.role).toBe(MOCK_TENANT.role);
    }
  });

  it('passes trimmed userId and trimmed businessId to resolver', async () => {
    const auth = mockAuth({ user: { id: '  user-trimmed  ' } });
    const resolver = successResolver();
    const adapter = adapterWithEnv(auth, bothFlagsEnv, resolver);
    await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: '  biz-trimmed  ' }),
    );
    expect(resolver).toHaveBeenCalledWith({
      userId: 'user-trimmed',
      businessId: 'biz-trimmed',
    });
  });

  it('calls auth with the request', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);
    const req = makeRequest({ [BUSINESS_SCOPE_HEADER]: 'biz-1' });
    await adapter.resolveTenant(req);
    expect(auth).toHaveBeenCalledWith(req);
  });
});

// ---------------------------------------------------------------------------
// 9b. resolveTenant — explicit scope (route param priority)
// ---------------------------------------------------------------------------

describe('resolveTenant — explicit scope', () => {
  it('uses scope.businessId instead of header when scope provided', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const resolver = successResolver();
    const adapter = adapterWithEnv(auth, bothFlagsEnv, resolver);
    await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'header-biz' }),
      { businessId: 'scope-biz', source: 'route-param' },
    );
    expect(resolver).toHaveBeenCalledWith({
      userId: 'user-1',
      businessId: 'scope-biz',
    });
  });

  it('uses scope.businessId when no header is present', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const resolver = successResolver();
    const adapter = adapterWithEnv(auth, bothFlagsEnv, resolver);
    const result = await adapter.resolveTenant(
      makeRequest(),
      { businessId: 'route-biz', source: 'route-param' },
    );
    expect(result.ok).toBe(true);
    expect(resolver).toHaveBeenCalledWith({
      userId: 'user-1',
      businessId: 'route-biz',
    });
  });

  it('falls back to header when scope.businessId is null', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const resolver = successResolver();
    const adapter = adapterWithEnv(auth, bothFlagsEnv, resolver);
    await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'header-biz' }),
      { businessId: null, source: 'header' },
    );
    expect(resolver).toHaveBeenCalledWith({
      userId: 'user-1',
      businessId: 'header-biz',
    });
  });

  it('falls back to header when scope.businessId is empty string', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const resolver = successResolver();
    const adapter = adapterWithEnv(auth, bothFlagsEnv, resolver);
    await adapter.resolveTenant(
      makeRequest({ [BUSINESS_SCOPE_HEADER]: 'header-biz' }),
      { businessId: '', source: 'test' },
    );
    expect(resolver).toHaveBeenCalledWith({
      userId: 'user-1',
      businessId: 'header-biz',
    });
  });

  it('returns 403 when scope.businessId is null and no header', async () => {
    const auth = mockAuth({ user: { id: 'user-1' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);
    const result = await adapter.resolveTenant(
      makeRequest(),
      { businessId: null },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. resolveSystem — always unavailable
// ---------------------------------------------------------------------------

describe('resolveSystem', () => {
  it('always returns 501 AUTH_CONTEXT_UNAVAILABLE', async () => {
    const auth = mockAuth({ user: { id: 'user-system' } });
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

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
    const adapter = adapterWithEnv(auth, bothFlagsEnv);

    await adapter.resolveSystem(makeRequest());
    expect(auth).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 11. createDefaultAuthjsAdapter
// ---------------------------------------------------------------------------

describe('createDefaultAuthjsAdapter', () => {
  it('returns an adapter with all three resolver methods', () => {
    const adapter = createDefaultAuthjsAdapter();
    expect(typeof adapter.resolveAuthenticated).toBe('function');
    expect(typeof adapter.resolveTenant).toBe('function');
    expect(typeof adapter.resolveSystem).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 12. Scope guards
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
  const ROUTE_PATH = path.join(
    PROJECT_ROOT,
    'src/app/api/auth/[...nextauth]/route.ts',
  );

  it('authjs-context-adapter.ts does not import the Auth.js package directly', () => {
    const content = fs.readFileSync(AUTHJS_CONTEXT_ADAPTER_PATH, 'utf-8');
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

  it('auth-context-adapter.ts scope guard still passes', () => {
    const content = fs.readFileSync(AUTH_CONTEXT_ADAPTER_PATH, 'utf-8');
    const forbidden = ['next-auth', 'jwt', 'cookie'];
    for (const f of forbidden) {
      expect(content).not.toContain(f);
    }
  });

  it('route.ts does not own cachedEnabledHandlers anymore', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).not.toContain('cachedEnabledHandlers');
    expect(content).not.toContain('createAuthjsRouteHandlers');
  });

  it('route.ts delegates to getEnabledAuthjsRuntime', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).toContain('getEnabledAuthjsRuntime');
  });

  it('authjs-runtime.ts does not use setter/getter pattern', () => {
    const content = fs.readFileSync(AUTHJS_RUNTIME_PATH, 'utf-8');
    expect(content).not.toContain('setAuthjsAuth');
    expect(content).not.toContain('getAuthjsAuth');
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

  it('authjs-route-handlers.ts includes jwt and session callbacks using token.sub', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/lib/auth/authjs-route-handlers.ts'),
      'utf-8',
    );
    expect(content).toContain('callbacks');
    expect(content).toContain('async jwt(');
    expect(content).toContain('async session(');
    expect(content).toContain('token.sub');
    // Must NOT use custom token.userId
    expect(content).not.toContain('token.userId');
  });

  it('authjs-route-handlers.ts does not call setAuthjsAuth', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/lib/auth/authjs-route-handlers.ts'),
      'utf-8',
    );
    expect(content).not.toContain('setAuthjsAuth');
  });
});

// ---------------------------------------------------------------------------
// 13. Feature flag constants
// ---------------------------------------------------------------------------

describe('TASK-0039 constants', () => {
  it('AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG is ENABLE_AUTHJS_REQUEST_CONTEXT', () => {
    expect(AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG).toBe(
      'ENABLE_AUTHJS_REQUEST_CONTEXT',
    );
  });

  it('error messages are non-empty strings', () => {
    expect(AUTHJS_REQUEST_CONTEXT_NOT_ENABLED_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_RUNTIME_NOT_ENABLED_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_SESSION_READ_FAILED_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_SESSION_MISSING_USER_ID_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_TENANT_CONTEXT_REQUIRED_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_TENANT_INVALID_BUSINESS_ID_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_TENANT_ACCESS_DENIED_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_TENANT_RESOLVER_FAILED_MESSAGE.length).toBeGreaterThan(0);
    expect(AUTHJS_SYSTEM_CONTEXT_UNAVAILABLE_MESSAGE.length).toBeGreaterThan(0);
  });
});
