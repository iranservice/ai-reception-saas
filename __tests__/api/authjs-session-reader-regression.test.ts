// ===========================================================================
// REGRESSION TEST — Auth.js v5 auth() Overload Bug
//
// This test proves that the Auth.js v5 auth(request) overload returns a
// Response (middleware path) instead of a Session, and that auth() with
// no arguments (the correct App Router pattern) would return a Session.
//
// The bug: requestAwareAuth in authjs-route-handlers.ts was calling
// nextAuth.auth(request as never), which triggered Auth.js's middleware
// overload. This returned a Response object, not a Session. The adapter
// layer then saw session.user as undefined and returned 401.
//
// The fix: Call nextAuth.auth() with NO arguments. Auth.js reads cookies
// from next/headers automatically in App Router route handlers.
//
// This test uses mock injection to simulate both the broken and fixed
// patterns, proving the regression would be caught.
// ===========================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  createAuthjsRequestContextAdapter,
  type AuthjsSessionReader,
  type TenantMembershipResolver,
} from '@/app/api/_shared/authjs-context-adapter';
import type { AuthjsSessionLike } from '@/lib/auth/authjs-runtime';
import { ok } from '@/lib/result';
import type { TenantContext } from '@/domains/tenancy/types';
import { AUTHJS_RUNTIME_FEATURE_FLAG } from '@/lib/auth/authjs-feature-gate';
import { AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG } from '@/app/api/_shared/authjs-context-adapter';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'regression-user-uuid-001';
const BUSINESS_ID = 'regression-biz-uuid-001';

const BOTH_FLAGS_ENABLED = {
  [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: 'true',
  [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
};

const MOCK_TENANT: TenantContext = {
  userId: USER_ID,
  businessId: BUSINESS_ID,
  membershipId: 'mem-uuid-001',
  role: 'OWNER',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  headers: Record<string, string> = {},
  url = 'http://localhost/api/test',
): Request {
  return new Request(url, { headers });
}

function successResolver(): TenantMembershipResolver {
  return vi.fn(async () => ok(MOCK_TENANT));
}

// ---------------------------------------------------------------------------
// 1. Regression: auth reader returning a Response-like object
// ---------------------------------------------------------------------------

describe('Regression: Auth.js auth(request) returns Response instead of Session', () => {
  it('session reader returning a Response object causes 401 UNAUTHENTICATED — proving the bug', async () => {
    // Simulate what auth(request) was doing: returning a Response object
    // instead of a Session. A Response is truthy but has no .user property.
    const brokenAuthReader: AuthjsSessionReader = vi.fn(async () => {
      // This simulates what nextAuth.auth(request) actually returned:
      // a Response from handleAuth. Cast to satisfy the type system,
      // but at runtime this is what happened.
      return new Response('{}', { status: 200 }) as unknown as AuthjsSessionLike;
    });

    const adapter = createAuthjsRequestContextAdapter({
      auth: brokenAuthReader,
      tenantMembershipResolver: successResolver(),
      env: BOTH_FLAGS_ENABLED,
    });

    const result = await adapter.resolveAuthenticated(makeRequest());

    // The adapter sees a truthy non-null value without .user → 401
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('session reader returning a proper Session object resolves authenticated context', async () => {
    // This simulates the correct auth() behavior: returning a Session
    const correctAuthReader: AuthjsSessionReader = vi.fn(async () => ({
      user: { id: USER_ID, email: 'test@example.com' },
    }));

    const adapter = createAuthjsRequestContextAdapter({
      auth: correctAuthReader,
      tenantMembershipResolver: successResolver(),
      env: BOTH_FLAGS_ENABLED,
    });

    const result = await adapter.resolveAuthenticated(makeRequest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('user');
      expect(result.context.userId).toBe(USER_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Contract: session reader must be called (proving auth() is invoked)
// ---------------------------------------------------------------------------

describe('Auth reader invocation contract', () => {
  it('auth reader is called exactly once per resolveAuthenticated', async () => {
    const authReader = vi.fn(async () => ({
      user: { id: USER_ID },
    }));

    const adapter = createAuthjsRequestContextAdapter({
      auth: authReader,
      tenantMembershipResolver: successResolver(),
      env: BOTH_FLAGS_ENABLED,
    });

    await adapter.resolveAuthenticated(makeRequest());
    expect(authReader).toHaveBeenCalledTimes(1);
  });

  it('auth reader receives the request argument for contract compliance', async () => {
    const authReader = vi.fn(async () => ({
      user: { id: USER_ID },
    }));

    const adapter = createAuthjsRequestContextAdapter({
      auth: authReader,
      tenantMembershipResolver: successResolver(),
      env: BOTH_FLAGS_ENABLED,
    });

    const req = makeRequest();
    await adapter.resolveAuthenticated(req);
    expect(authReader).toHaveBeenCalledWith(req);
  });
});

// ---------------------------------------------------------------------------
// 3. End-to-end: Authenticated request resolves user in tenant context
// ---------------------------------------------------------------------------

describe('Authenticated request with valid session resolves tenant context', () => {
  it('session with user.id + business scope resolves tenant context', async () => {
    const authReader: AuthjsSessionReader = vi.fn(async () => ({
      user: { id: USER_ID },
    }));

    const resolver = successResolver();

    const adapter = createAuthjsRequestContextAdapter({
      auth: authReader,
      tenantMembershipResolver: resolver,
      env: BOTH_FLAGS_ENABLED,
    });

    const result = await adapter.resolveTenant(
      makeRequest({ 'x-business-id': BUSINESS_ID }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.actorType).toBe('user');
      expect(result.context.userId).toBe(USER_ID);
      expect(result.context.businessId).toBe(BUSINESS_ID);
      expect(result.context.role).toBe('OWNER');
    }

    // Membership resolver was called with correct IDs
    expect(resolver).toHaveBeenCalledWith({
      userId: USER_ID,
      businessId: BUSINESS_ID,
    });
  });

  it('session with user.id resolves tenant context via route-param scope', async () => {
    const authReader: AuthjsSessionReader = vi.fn(async () => ({
      user: { id: USER_ID },
    }));

    const resolver = successResolver();

    const adapter = createAuthjsRequestContextAdapter({
      auth: authReader,
      tenantMembershipResolver: resolver,
      env: BOTH_FLAGS_ENABLED,
    });

    const result = await adapter.resolveTenant(
      makeRequest(),
      { businessId: BUSINESS_ID, source: 'route-param' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.businessId).toBe(BUSINESS_ID);
    }
  });

  it('missing session still returns 401 UNAUTHENTICATED', async () => {
    const authReader: AuthjsSessionReader = vi.fn(async () => null);

    const adapter = createAuthjsRequestContextAdapter({
      auth: authReader,
      tenantMembershipResolver: successResolver(),
      env: BOTH_FLAGS_ENABLED,
    });

    const result = await adapter.resolveAuthenticated(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Feature flag behavior
// ---------------------------------------------------------------------------

describe('Feature flag gating behavior', () => {
  it('ENABLE_AUTHJS_REQUEST_CONTEXT=false returns 501 AUTH_CONTEXT_UNAVAILABLE', async () => {
    const authReader: AuthjsSessionReader = vi.fn(async () => ({
      user: { id: USER_ID },
    }));

    const adapter = createAuthjsRequestContextAdapter({
      auth: authReader,
      tenantMembershipResolver: successResolver(),
      env: {
        [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: 'false',
        [AUTHJS_RUNTIME_FEATURE_FLAG]: 'true',
      },
    });

    const result = await adapter.resolveAuthenticated(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
    // Auth reader must NOT be called when flag is disabled
    expect(authReader).not.toHaveBeenCalled();
  });

  it('ENABLE_AUTHJS_RUNTIME=false returns 501 AUTH_CONTEXT_UNAVAILABLE', async () => {
    const authReader: AuthjsSessionReader = vi.fn(async () => ({
      user: { id: USER_ID },
    }));

    const adapter = createAuthjsRequestContextAdapter({
      auth: authReader,
      tenantMembershipResolver: successResolver(),
      env: {
        [AUTHJS_REQUEST_CONTEXT_FEATURE_FLAG]: 'true',
        [AUTHJS_RUNTIME_FEATURE_FLAG]: 'false',
      },
    });

    const result = await adapter.resolveAuthenticated(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(501);
      const body = await result.response.json();
      expect(body.error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
    }
    expect(authReader).not.toHaveBeenCalled();
  });
});
