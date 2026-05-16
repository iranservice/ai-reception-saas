// ===========================================================================
// TASK-0041 — Auth.js Request-Context Protected Handler Smoke Tests
//
// Integration-style tests proving protected API handlers work correctly
// with the REAL Auth.js request-context adapter (createAuthjsRequestContextAdapter).
//
// Tests inject a real adapter instance (with mocked auth session reader and
// tenant membership resolver) into handler factories — exercising the full
// adapter → handler pipeline including feature-flag gates, scope resolution,
// businessId normalization, and error mapping.
//
// Tests cover:
//   A. Business workspace protected handlers (GET/PATCH by ID)
//   B. Business membership protected handlers (LIST/CREATE/mutation)
//   C. Tenant audit protected handlers (LIST/GET by ID)
//   D. Authz tenant-scoped generic handlers (evaluate/require)
//   E. Negative smoke cases (unauth, invalid, denied)
// ===========================================================================

import { describe, it, expect, vi } from 'vitest';
import { makeJsonRequest } from '@/app/api/_shared/request';
import { ok, err } from '@/lib/result';

// Real adapter factory and types
import {
  createAuthjsRequestContextAdapter,
  BUSINESS_SCOPE_HEADER,
  type AuthjsSessionReader,
  type TenantMembershipResolver,
  type AuthjsRequestContextAdapterOptions,
} from '@/app/api/_shared/authjs-context-adapter';

import type { TenantRequestScope } from '@/app/api/_shared/request-context';

// Handler factories
import {
  createGetBusinessByIdHandler,
  createPatchBusinessByIdHandler,
} from '@/app/api/businesses/handler';

import {
  createGetBusinessMembershipsHandler,
  createPostBusinessMembershipsHandler,
  createPatchMembershipRoleHandler,
} from '@/app/api/businesses/[businessId]/memberships/handler';

import {
  createGetAuditEventsHandler,
  createGetAuditEventByIdHandler,
} from '@/app/api/businesses/[businessId]/audit-events/handler';

import {
  createPostAuthzEvaluateHandler,
  createPostAuthzRequireHandler,
} from '@/app/api/authz/handler';

// Domain types
import type { BusinessIdentity, BusinessMembershipIdentity, TenantContext } from '@/domains/tenancy/types';
import type { AuditEventIdentity } from '@/domains/audit/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BUSINESS_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_BUSINESS_ID = '55555555-5555-4555-8555-555555555555';
const MEMBERSHIP_ID = '66666666-6666-4666-8666-666666666666';
const TARGET_MEMBERSHIP_ID = '88888888-8888-4888-8888-888888888888';
const AUDIT_EVENT_ID = '77777777-7777-4777-8777-777777777777';

// Environment with both feature flags enabled
const ENABLED_ENV: Record<string, string | undefined> = {
  ENABLE_AUTHJS_REQUEST_CONTEXT: 'true',
  ENABLE_AUTHJS_RUNTIME: 'true',
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_BUSINESS: BusinessIdentity = {
  id: BUSINESS_ID,
  name: 'Smoke Business',
  slug: 'smoke-business',
  status: 'ACTIVE',
  timezone: 'Asia/Tehran',
  locale: 'fa',
  createdByUserId: USER_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_MEMBERSHIP: BusinessMembershipIdentity = {
  id: TARGET_MEMBERSHIP_ID,
  businessId: BUSINESS_ID,
  userId: USER_ID,
  role: 'ADMIN',
  status: 'ACTIVE',
  invitedByUserId: null,
  joinedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_TENANT_CONTEXT: TenantContext = {
  businessId: BUSINESS_ID,
  userId: USER_ID,
  membershipId: MEMBERSHIP_ID,
  role: 'OWNER',
};

const MOCK_AUDIT_EVENT: AuditEventIdentity = {
  id: AUDIT_EVENT_ID,
  businessId: BUSINESS_ID,
  actorType: 'USER',
  actorUserId: USER_ID,
  action: 'business.update',
  targetType: 'business',
  targetId: BUSINESS_ID,
  result: 'SUCCESS',
  metadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Real adapter helper — creates adapter from mocked auth + resolver
// ---------------------------------------------------------------------------

/**
 * Creates a real Auth.js request-context adapter with injectable mocks.
 *
 * - `auth` defaults to returning a session with USER_ID
 * - `resolver` defaults to returning MOCK_TENANT_CONTEXT
 * - `env` defaults to both flags enabled
 */
function createRealAdapter(overrides?: {
  auth?: AuthjsSessionReader;
  resolver?: TenantMembershipResolver;
  env?: Record<string, string | undefined>;
}) {
  const auth: AuthjsSessionReader =
    overrides?.auth ?? (async () => ({ user: { id: USER_ID } }));

  const resolver: TenantMembershipResolver =
    overrides?.resolver ?? vi.fn(async () => ok(MOCK_TENANT_CONTEXT));

  const env = overrides?.env ?? ENABLED_ENV;

  const adapter = createAuthjsRequestContextAdapter({ auth, tenantMembershipResolver: resolver, env });

  return { adapter, auth, resolver };
}

/**
 * Wraps a real adapter's resolveTenant into the handler-compatible signature.
 */
function tenantResolverFromAdapter(adapter: ReturnType<typeof createAuthjsRequestContextAdapter>) {
  return (request: Request, scope?: TenantRequestScope) => adapter.resolveTenant(request, scope);
}

/**
 * Wraps a real adapter's resolveAuthenticated into the handler-compatible signature.
 */
function authResolverFromAdapter(adapter: ReturnType<typeof createAuthjsRequestContextAdapter>) {
  return (request: Request) => adapter.resolveAuthenticated(request);
}

// ---------------------------------------------------------------------------
// Mock service factories
// ---------------------------------------------------------------------------

function mockBusinessServices() {
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

function mockMembershipServices() {
  return {
    tenancyService: {
      createMembership: vi.fn(),
      findMembershipById: vi.fn(),
      listBusinessMemberships: vi.fn(),
      updateMembershipRole: vi.fn(),
      updateMembershipStatus: vi.fn(),
      removeMembership: vi.fn(),
    },
    authzService: {
      requirePermission: vi.fn(),
    },
  };
}

function mockAuditServices() {
  return {
    auditService: {
      listAuditEvents: vi.fn(),
      findAuditEventById: vi.fn(),
    },
    authzService: {
      requirePermission: vi.fn(),
    },
  };
}

function mockAuthzServices() {
  return {
    authzService: {
      evaluateAccess: vi.fn(),
      requirePermission: vi.fn(),
      listRolePermissions: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// A. Business workspace protected handlers
// ---------------------------------------------------------------------------

describe('A. Business workspace — real Auth.js adapter smoke', () => {
  // A1. GET /api/businesses/:businessId — happy path
  it('A1: GET by ID with real Auth.js adapter returns 200', async () => {
    const s = mockBusinessServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.findBusinessById.mockResolvedValue(ok(MOCK_BUSINESS));

    const { adapter } = createRealAdapter();
    const h = createGetBusinessByIdHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(BUSINESS_ID);

    // authz business.read was checked
    expect(s.authzService.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'business.read' }),
    );
  });

  // A2. PATCH /api/businesses/:businessId — route param canonical
  it('A2: PATCH by ID uses route-param scope, ignoring mismatched header', async () => {
    const s = mockBusinessServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.updateBusiness.mockResolvedValue(ok({ ...MOCK_BUSINESS, name: 'Updated' }));

    const resolverMock = vi.fn(async () => ok(MOCK_TENANT_CONTEXT));
    const { adapter } = createRealAdapter({ resolver: resolverMock });
    const resolveTenant = vi.fn(tenantResolverFromAdapter(adapter));
    const h = createPatchBusinessByIdHandler({ ...s, resolveTenantContext: resolveTenant });

    const res = await h(
      makeJsonRequest({ name: 'Updated' }, {
        headers: { [BUSINESS_SCOPE_HEADER]: OTHER_BUSINESS_ID },
      }),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(200);

    // Handler passed route-param scope to the adapter
    expect(resolveTenant).toHaveBeenCalledWith(
      expect.any(Request),
      { businessId: BUSINESS_ID, source: 'route-param' },
    );

    // The real adapter resolved with route-param, NOT header
    expect(resolverMock).toHaveBeenCalledWith({
      userId: USER_ID,
      businessId: BUSINESS_ID,
    });

    // authz business.update checked
    expect(s.authzService.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'business.update' }),
    );

    // service called with route businessId
    expect(s.tenancyService.updateBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BUSINESS_ID }),
    );
  });
});

// ---------------------------------------------------------------------------
// B. Business membership protected handlers
// ---------------------------------------------------------------------------

describe('B. Business memberships — real Auth.js adapter smoke', () => {
  // B3. GET /api/businesses/:businessId/memberships
  it('B3: LIST memberships with real Auth.js adapter returns 200', async () => {
    const s = mockMembershipServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.listBusinessMemberships.mockResolvedValue(ok([MOCK_MEMBERSHIP]));

    const { adapter } = createRealAdapter();
    const h = createGetBusinessMembershipsHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID + '/memberships'),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(200);
    expect(s.authzService.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'members.read' }),
    );
    expect(s.tenancyService.listBusinessMemberships).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BUSINESS_ID }),
    );
  });

  // B4. POST /api/businesses/:businessId/memberships
  it('B4: CREATE membership with real Auth.js adapter validates body and returns 200', async () => {
    const s = mockMembershipServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.createMembership.mockResolvedValue(ok(MOCK_MEMBERSHIP));

    const { adapter } = createRealAdapter();
    const h = createPostBusinessMembershipsHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const newMemberUserId = '99999999-9999-4999-8999-999999999999';
    const res = await h(
      makeJsonRequest({ userId: newMemberUserId, role: 'VIEWER' }),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(200);
    expect(s.tenancyService.createMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: BUSINESS_ID,
        userId: newMemberUserId,
      }),
    );
  });

  // B5. PATCH membership role — route businessId scope wins
  it('B5: PATCH membership role uses route businessId, authz checked before service', async () => {
    const s = mockMembershipServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.findMembershipById.mockResolvedValue(ok(MOCK_MEMBERSHIP));
    s.tenancyService.updateMembershipRole.mockResolvedValue(
      ok({ ...MOCK_MEMBERSHIP, role: 'OPERATOR' }),
    );

    const resolverMock = vi.fn(async () => ok(MOCK_TENANT_CONTEXT));
    const { adapter } = createRealAdapter({ resolver: resolverMock });
    const resolveTenant = vi.fn(tenantResolverFromAdapter(adapter));
    const h = createPatchMembershipRoleHandler({ ...s, resolveTenantContext: resolveTenant });

    const res = await h(
      makeJsonRequest({ role: 'OPERATOR' }, {
        headers: { [BUSINESS_SCOPE_HEADER]: OTHER_BUSINESS_ID },
      }),
      { businessId: BUSINESS_ID, membershipId: TARGET_MEMBERSHIP_ID },
    );

    expect(res.status).toBe(200);

    // Handler passed route-param scope
    expect(resolveTenant).toHaveBeenCalledWith(
      expect.any(Request),
      { businessId: BUSINESS_ID, source: 'route-param' },
    );

    // Real adapter resolved with route-param businessId
    expect(resolverMock).toHaveBeenCalledWith({
      userId: USER_ID,
      businessId: BUSINESS_ID,
    });

    // authz checked
    expect(s.authzService.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'members.change_role' }),
    );
  });
});

// ---------------------------------------------------------------------------
// C. Tenant audit protected handlers
// ---------------------------------------------------------------------------

describe('C. Tenant audit — real Auth.js adapter smoke', () => {
  // C6. GET /api/businesses/:businessId/audit-events
  it('C6: LIST audit events with real Auth.js adapter returns 200', async () => {
    const s = mockAuditServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.auditService.listAuditEvents.mockResolvedValue(ok([MOCK_AUDIT_EVENT]));

    const { adapter } = createRealAdapter();
    const h = createGetAuditEventsHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID + '/audit-events'),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(200);
    expect(s.authzService.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'audit.read' }),
    );
    expect(s.auditService.listAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BUSINESS_ID }),
    );
  });

  // C7. GET /api/businesses/:businessId/audit-events/:auditEventId
  it('C7: GET audit event by ID returns 200 when event belongs to business', async () => {
    const s = mockAuditServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.auditService.findAuditEventById.mockResolvedValue(ok(MOCK_AUDIT_EVENT));

    const { adapter } = createRealAdapter();
    const h = createGetAuditEventByIdHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID + '/audit-events/' + AUDIT_EVENT_ID),
      { businessId: BUSINESS_ID, auditEventId: AUDIT_EVENT_ID },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(AUDIT_EVENT_ID);
  });
});

// ---------------------------------------------------------------------------
// D. Authz tenant-scoped generic handlers (header fallback)
// ---------------------------------------------------------------------------

describe('D. Authz generic tenant — real Auth.js adapter smoke', () => {
  // D8. POST /api/authz/evaluate — header fallback
  it('D8: evaluate uses x-business-id header (no route param), returns 200', async () => {
    const resolverMock = vi.fn(async () => ok(MOCK_TENANT_CONTEXT));
    const { adapter } = createRealAdapter({ resolver: resolverMock });

    const s = mockAuthzServices();
    s.authzService.evaluateAccess.mockResolvedValue(
      ok({ allowed: true, permission: 'business.read' }),
    );

    const h = createPostAuthzEvaluateHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      makeJsonRequest({ permission: 'business.read' }, {
        headers: { [BUSINESS_SCOPE_HEADER]: BUSINESS_ID },
      }),
    );

    expect(res.status).toBe(200);

    // Adapter used x-business-id header as fallback (no scope passed)
    expect(resolverMock).toHaveBeenCalledWith({
      userId: USER_ID,
      businessId: BUSINESS_ID,
    });

    expect(s.authzService.evaluateAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        businessId: BUSINESS_ID,
        permission: 'business.read',
      }),
    );
  });

  // D9. POST /api/authz/require — denied returns ok (decision, not error)
  it('D9: require with denied result returns 200 with allowed:false', async () => {
    const { adapter } = createRealAdapter();

    const s = mockAuthzServices();
    s.authzService.requirePermission.mockResolvedValue(
      ok({ allowed: false, reason: 'Insufficient role' }),
    );

    const h = createPostAuthzRequireHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      makeJsonRequest({ permission: 'business.delete' }, {
        headers: { [BUSINESS_SCOPE_HEADER]: BUSINESS_ID },
      }),
    );

    // requirePermission returns ok({ allowed: false }) — not an error
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// E. Negative smoke cases
// ---------------------------------------------------------------------------

describe('E. Negative smoke cases — real Auth.js adapter', () => {
  // E10. No Auth.js session → UNAUTHENTICATED 401
  it('E10: null session returns 401 UNAUTHENTICATED', async () => {
    const s = mockBusinessServices();
    const { adapter } = createRealAdapter({
      auth: async () => null,
    });

    const h = createGetBusinessByIdHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(s.authzService.requirePermission).not.toHaveBeenCalled();
    expect(s.tenancyService.findBusinessById).not.toHaveBeenCalled();
  });

  // E11. Missing session.user.id → INVALID_AUTH_CONTEXT 400
  it('E11: empty session.user.id returns 400 INVALID_AUTH_CONTEXT', async () => {
    const s = mockBusinessServices();
    const { adapter } = createRealAdapter({
      auth: async () => ({ user: { id: '  ' } }),
    });

    const h = createGetBusinessByIdHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_AUTH_CONTEXT');
    expect(s.tenancyService.findBusinessById).not.toHaveBeenCalled();
  });

  // E12. Route-param scope with mismatched header still uses route param
  it('E12: mismatched header does not override route-param businessId', async () => {
    const s = mockMembershipServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.listBusinessMemberships.mockResolvedValue(ok([MOCK_MEMBERSHIP]));

    const resolverMock = vi.fn(async () => ok(MOCK_TENANT_CONTEXT));
    const { adapter } = createRealAdapter({ resolver: resolverMock });
    const resolveTenant = vi.fn(tenantResolverFromAdapter(adapter));

    const h = createGetBusinessMembershipsHandler({ ...s, resolveTenantContext: resolveTenant });

    const res = await h(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID + '/memberships', {
        headers: { [BUSINESS_SCOPE_HEADER]: OTHER_BUSINESS_ID },
      }),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(200);

    // Handler passed route-param scope
    expect(resolveTenant).toHaveBeenCalledWith(
      expect.any(Request),
      { businessId: BUSINESS_ID, source: 'route-param' },
    );

    // Real adapter used BUSINESS_ID from scope, NOT OTHER_BUSINESS_ID from header
    expect(resolverMock).toHaveBeenCalledWith({
      userId: USER_ID,
      businessId: BUSINESS_ID,
    });
  });

  // E13. Route-param source with blank businessId → 403 (real adapter never falls back)
  it('E13: blank route-param scope returns 403 via real adapter, no membership call', async () => {
    const resolverMock = vi.fn(async () => ok(MOCK_TENANT_CONTEXT));
    const { adapter } = createRealAdapter({ resolver: resolverMock });

    // Call the real adapter directly with blank route-param scope
    const result = await adapter.resolveTenant(
      new Request('http://localhost', {
        headers: { [BUSINESS_SCOPE_HEADER]: BUSINESS_ID },
      }),
      { businessId: '', source: 'route-param' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error.code).toBe('TENANT_CONTEXT_REQUIRED');
    }

    // Membership resolver never called
    expect(resolverMock).not.toHaveBeenCalled();
  });

  // E14. Generic tenant route without x-business-id → 403
  it('E14: authz evaluate without x-business-id header returns 403', async () => {
    const s = mockAuthzServices();
    const { adapter } = createRealAdapter();

    const h = createPostAuthzEvaluateHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      makeJsonRequest({ permission: 'business.read' }),
      // no x-business-id header
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TENANT_CONTEXT_REQUIRED');
    expect(s.authzService.evaluateAccess).not.toHaveBeenCalled();
  });

  // E15. Membership lookup denied → no downstream service call
  it('E15: membership denied returns 403, no downstream service call', async () => {
    const s = mockAuditServices();
    const { adapter } = createRealAdapter({
      resolver: async () => err('ACCESS_DENIED', 'No active membership'),
    });

    const h = createGetAuditEventsHandler({
      ...s,
      resolveTenantContext: tenantResolverFromAdapter(adapter),
    });

    const res = await h(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID + '/audit-events'),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ACCESS_DENIED');
    expect(s.authzService.requirePermission).not.toHaveBeenCalled();
    expect(s.auditService.listAuditEvents).not.toHaveBeenCalled();
  });
});
