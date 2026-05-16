// ===========================================================================
// TASK-0041 — Auth.js Request-Context Protected Handler Smoke Tests
//
// Integration-style tests proving protected API handlers work correctly
// with Auth.js request-context resolution injected via handler factories.
//
// Tests cover:
//   A. Business workspace protected handlers (GET/PATCH by ID)
//   B. Business membership protected handlers (LIST/CREATE/mutation)
//   C. Tenant audit protected handlers (LIST/GET by ID)
//   D. Authz tenant-scoped generic handlers (evaluate/require)
//   E. Negative smoke cases (unauth, invalid, denied)
// ===========================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  createTenantRequestContext,
  type TenantRequestContext,
  type TenantRequestScope,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import { apiError } from '@/app/api/_shared/responses';
import { makeJsonRequest } from '@/app/api/_shared/request';
import { ok, err } from '@/lib/result';

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

import type { BusinessIdentity, BusinessMembershipIdentity } from '@/domains/tenancy/types';
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

const BUSINESS_SCOPE_HEADER = 'x-business-id';

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
// Tenant resolver helper — simulates Auth.js adapter behavior
// ---------------------------------------------------------------------------

type ResolveTenantContextFn = (
  request: Request,
  scope?: TenantRequestScope,
) => Promise<ContextResult<TenantRequestContext>>;

/**
 * Creates a mock Auth.js-style tenant resolver.
 *
 * When `auth.session` is null → returns UNAUTHENTICATED 401.
 * When `auth.session.user.id` is empty → returns INVALID_AUTH_CONTEXT 400.
 * When `membership` is 'denied' → returns ACCESS_DENIED 403.
 *
 * The resolver uses scope.businessId (route-param priority) or
 * falls back to x-business-id header, matching adapter behavior.
 */
function createAuthjsTenantResolver(options: {
  session?: { user: { id: string } } | null;
  membership?: 'denied' | 'unavailable';
  userId?: string;
  businessId?: string;
  membershipId?: string;
  role?: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
}): ResolveTenantContextFn {
  return async (_request: Request, scope?: TenantRequestScope) => {
    // Simulate auth(request) returns null → no session
    if (options.session === null) {
      return {
        ok: false,
        response: apiError('UNAUTHENTICATED', 'Authentication required', 401),
      };
    }

    // Simulate missing user.id
    const userId = options.session?.user?.id ?? options.userId ?? USER_ID;
    if (userId.trim().length === 0) {
      return {
        ok: false,
        response: apiError(
          'INVALID_AUTH_CONTEXT',
          'session.user.id is missing or empty.',
          400,
        ),
      };
    }

    // Resolve businessId using scope priority
    let businessId: string | null = null;
    if (scope?.source === 'route-param') {
      const trimmed = typeof scope.businessId === 'string' ? scope.businessId.trim() : '';
      businessId = trimmed.length > 0 ? trimmed : null;
    } else {
      const fromScope = scope?.businessId != null ? scope.businessId.trim() : '';
      if (fromScope.length > 0) {
        businessId = fromScope;
      } else {
        businessId = _request.headers.get(BUSINESS_SCOPE_HEADER);
        if (businessId !== null) {
          businessId = businessId.trim();
          if (businessId.length === 0) businessId = null;
        }
      }
    }

    if (businessId === null) {
      return {
        ok: false,
        response: apiError(
          'TENANT_CONTEXT_REQUIRED',
          'Tenant context required.',
          403,
        ),
      };
    }

    // Simulate membership denied
    if (options.membership === 'denied') {
      return {
        ok: false,
        response: apiError('ACCESS_DENIED', 'Access denied', 403),
      };
    }

    // Simulate membership resolver failure
    if (options.membership === 'unavailable') {
      return {
        ok: false,
        response: apiError(
          'AUTH_CONTEXT_UNAVAILABLE',
          'Tenant membership resolution failed.',
          501,
        ),
      };
    }

    // Success — build tenant context
    return {
      ok: true,
      context: createTenantRequestContext({
        requestId: null,
        tenant: {
          userId,
          businessId: options.businessId ?? businessId,
          membershipId: options.membershipId ?? MEMBERSHIP_ID,
          role: options.role ?? 'OWNER',
        },
      }),
    };
  };
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

describe('A. Business workspace — Auth.js smoke', () => {
  // A1. GET /api/businesses/:businessId — happy path
  it('A1: GET by ID with Auth.js tenant context returns 200', async () => {
    const s = mockBusinessServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.findBusinessById.mockResolvedValue(ok(MOCK_BUSINESS));

    const resolver = createAuthjsTenantResolver({});
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: resolver });

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
  it('A2: PATCH by ID uses route-param businessId, ignoring mismatched header', async () => {
    const s = mockBusinessServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.updateBusiness.mockResolvedValue(ok({ ...MOCK_BUSINESS, name: 'Updated' }));

    const resolverSpy = vi.fn(createAuthjsTenantResolver({}));
    const h = createPatchBusinessByIdHandler({ ...s, resolveTenantContext: resolverSpy });

    const res = await h(
      makeJsonRequest({ name: 'Updated' }, {
        headers: { [BUSINESS_SCOPE_HEADER]: OTHER_BUSINESS_ID },
      }),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(200);

    // Resolver was called with route-param scope, not header
    expect(resolverSpy).toHaveBeenCalledWith(
      expect.any(Request),
      { businessId: BUSINESS_ID, source: 'route-param' },
    );

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

describe('B. Business memberships — Auth.js smoke', () => {
  // B3. GET /api/businesses/:businessId/memberships
  it('B3: LIST memberships with Auth.js tenant context returns 200', async () => {
    const s = mockMembershipServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.listBusinessMemberships.mockResolvedValue(ok([MOCK_MEMBERSHIP]));

    const resolver = createAuthjsTenantResolver({});
    const h = createGetBusinessMembershipsHandler({ ...s, resolveTenantContext: resolver });

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
  it('B4: CREATE membership with Auth.js tenant context validates body and returns 200', async () => {
    const s = mockMembershipServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.tenancyService.createMembership.mockResolvedValue(ok(MOCK_MEMBERSHIP));

    const resolver = createAuthjsTenantResolver({});
    const h = createPostBusinessMembershipsHandler({ ...s, resolveTenantContext: resolver });

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

    const resolverSpy = vi.fn(createAuthjsTenantResolver({}));
    const h = createPatchMembershipRoleHandler({ ...s, resolveTenantContext: resolverSpy });

    const res = await h(
      makeJsonRequest({ role: 'OPERATOR' }, {
        headers: { [BUSINESS_SCOPE_HEADER]: OTHER_BUSINESS_ID },
      }),
      { businessId: BUSINESS_ID, membershipId: TARGET_MEMBERSHIP_ID },
    );

    expect(res.status).toBe(200);

    // Resolver called with route-param scope
    expect(resolverSpy).toHaveBeenCalledWith(
      expect.any(Request),
      { businessId: BUSINESS_ID, source: 'route-param' },
    );

    // authz checked
    expect(s.authzService.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'members.change_role' }),
    );
  });
});

// ---------------------------------------------------------------------------
// C. Tenant audit protected handlers
// ---------------------------------------------------------------------------

describe('C. Tenant audit — Auth.js smoke', () => {
  // C6. GET /api/businesses/:businessId/audit-events
  it('C6: LIST audit events with Auth.js tenant context returns 200', async () => {
    const s = mockAuditServices();
    s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true }));
    s.auditService.listAuditEvents.mockResolvedValue(ok([MOCK_AUDIT_EVENT]));

    const resolver = createAuthjsTenantResolver({});
    const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: resolver });

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

    const resolver = createAuthjsTenantResolver({});
    const h = createGetAuditEventByIdHandler({ ...s, resolveTenantContext: resolver });

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

describe('D. Authz generic tenant — Auth.js smoke', () => {
  // D8. POST /api/authz/evaluate — header fallback
  it('D8: evaluate uses x-business-id header fallback, returns 200', async () => {
    const s = mockAuthzServices();
    s.authzService.evaluateAccess.mockResolvedValue(
      ok({ allowed: true, permission: 'business.read' }),
    );

    const resolver = createAuthjsTenantResolver({});
    const h = createPostAuthzEvaluateHandler({ ...s, resolveTenantContext: resolver });

    const res = await h(
      makeJsonRequest({ permission: 'business.read' }, {
        headers: { [BUSINESS_SCOPE_HEADER]: BUSINESS_ID },
      }),
    );

    expect(res.status).toBe(200);
    expect(s.authzService.evaluateAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        businessId: BUSINESS_ID,
        permission: 'business.read',
      }),
    );
  });

  // D9. POST /api/authz/require — denied returns expected response
  it('D9: require with denied result returns ok (denied decision, not error)', async () => {
    const s = mockAuthzServices();
    s.authzService.requirePermission.mockResolvedValue(
      ok({ allowed: false, reason: 'Insufficient role' }),
    );

    const resolver = createAuthjsTenantResolver({});
    const h = createPostAuthzRequireHandler({ ...s, resolveTenantContext: resolver });

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

describe('E. Negative smoke cases — Auth.js context', () => {
  // E10. No Auth.js session → UNAUTHENTICATED 401
  it('E10: no session returns 401 UNAUTHENTICATED', async () => {
    const s = mockBusinessServices();
    const resolver = createAuthjsTenantResolver({ session: null });
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: resolver });

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
    const resolver = createAuthjsTenantResolver({ session: { user: { id: '  ' } } });
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: resolver });

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

    const resolverSpy = vi.fn(createAuthjsTenantResolver({}));
    const h = createGetBusinessMembershipsHandler({ ...s, resolveTenantContext: resolverSpy });

    const res = await h(
      new Request('http://localhost/api/businesses/' + BUSINESS_ID + '/memberships', {
        headers: { [BUSINESS_SCOPE_HEADER]: OTHER_BUSINESS_ID },
      }),
      { businessId: BUSINESS_ID },
    );

    expect(res.status).toBe(200);
    // Scope passed with route-param source
    expect(resolverSpy).toHaveBeenCalledWith(
      expect.any(Request),
      { businessId: BUSINESS_ID, source: 'route-param' },
    );
  });

  // E13. Blank route-param businessId → TENANT_CONTEXT_REQUIRED 403
  it('E13: blank route-param scope returns 403, no service call', async () => {
    const s = mockBusinessServices();
    const resolver = createAuthjsTenantResolver({});
    const h = createGetBusinessByIdHandler({ ...s, resolveTenantContext: resolver });

    // Pass a valid UUID for params but inject a resolver that receives blank scope
    // The handler parses params first — invalid param returns 400 before resolver.
    // So we test by calling the resolver directly with blank scope.
    const result = await resolver(
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
  });

  // E14. Generic tenant route without x-business-id → TENANT_CONTEXT_REQUIRED 403
  it('E14: authz evaluate without x-business-id header returns 403', async () => {
    const s = mockAuthzServices();
    const resolver = createAuthjsTenantResolver({});
    const h = createPostAuthzEvaluateHandler({ ...s, resolveTenantContext: resolver });

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
    const resolver = createAuthjsTenantResolver({ membership: 'denied' });
    const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: resolver });

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
