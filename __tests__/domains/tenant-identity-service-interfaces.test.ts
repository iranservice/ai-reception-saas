import { describe, it, expect } from 'vitest';
import { ok } from '../../src/lib/result';

// ---------------------------------------------------------------------------
// Type-only imports (interfaces don't exist at runtime)
// ---------------------------------------------------------------------------

import type { IdentityService } from '../../src/domains/identity';
import type { TenancyService } from '../../src/domains/tenancy';
import type { AuthzService } from '../../src/domains/authz';
import type { AuditService } from '../../src/domains/audit';

// ---------------------------------------------------------------------------
// Runtime imports (constants exist at runtime)
// ---------------------------------------------------------------------------

import { IDENTITY_ERROR_CODES } from '../../src/domains/identity';
import { TENANCY_ERROR_CODES } from '../../src/domains/tenancy';
import { AUTHZ_ERROR_CODES } from '../../src/domains/authz';
import { AUDIT_ERROR_CODES } from '../../src/domains/audit';

// ===========================================================================
// Compile-time type assertions
//
// These ensure that service interfaces are well-formed and importable.
// They produce no runtime code but will cause TS errors if types break.
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertIdentityService = IdentityService;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertTenancyService = TenancyService;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertAuthzService = AuthzService;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AssertAuditService = AuditService;

// ===========================================================================
// Compile-time shape verification using satisfies
// ===========================================================================

const MOCK_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  name: 'Test',
  locale: 'en',
  status: 'ACTIVE' as const,
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_SESSION = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  tokenHash: 'a'.repeat(64),
  expiresAt: '2026-12-31T23:59:59.000Z',
  revokedAt: null,
  ipAddress: null,
  userAgent: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_BUSINESS = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Test Business',
  slug: 'test-business',
  status: 'ACTIVE' as const,
  timezone: 'Asia/Tehran',
  locale: 'fa',
  createdByUserId: '550e8400-e29b-41d4-a716-446655440000',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_MEMBERSHIP = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  businessId: '550e8400-e29b-41d4-a716-446655440002',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  role: 'OWNER' as const,
  status: 'ACTIVE' as const,
  invitedByUserId: null,
  joinedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_TENANT_CONTEXT = {
  businessId: '550e8400-e29b-41d4-a716-446655440002',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  membershipId: '550e8400-e29b-41d4-a716-446655440003',
  role: 'OWNER' as const,
};

const MOCK_AUDIT_EVENT = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  businessId: '550e8400-e29b-41d4-a716-446655440002',
  actorType: 'USER' as const,
  actorUserId: '550e8400-e29b-41d4-a716-446655440000',
  action: 'member.invited',
  targetType: 'membership',
  targetId: '550e8400-e29b-41d4-a716-446655440003',
  result: 'SUCCESS' as const,
  metadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Compile-time shape checks — these verify interface conformance at build time
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _identityServiceShape = {
  createUser: async () => ok(MOCK_USER),
  updateUser: async () => ok(MOCK_USER),
  updateUserStatus: async () => ok(MOCK_USER),
  findUserById: async () => ok(MOCK_USER),
  findUserByEmail: async () => ok(null),
  createSession: async () => ok(MOCK_SESSION),
  findSessionById: async () => ok(MOCK_SESSION),
  findSessionByTokenHash: async () => ok(null),
  listUserSessions: async () => ok([MOCK_SESSION] as const),
  revokeSession: async () => ok(MOCK_SESSION),
} satisfies IdentityService;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _tenancyServiceShape = {
  createBusiness: async () => ok(MOCK_BUSINESS),
  updateBusiness: async () => ok(MOCK_BUSINESS),
  findBusinessById: async () => ok(MOCK_BUSINESS),
  findBusinessBySlug: async () => ok(null),
  listUserBusinesses: async () => ok([MOCK_BUSINESS] as const),
  createMembership: async () => ok(MOCK_MEMBERSHIP),
  findMembership: async () => ok(MOCK_MEMBERSHIP),
  findMembershipById: async () => ok(null),
  listBusinessMemberships: async () => ok([MOCK_MEMBERSHIP] as const),
  updateMembershipRole: async () => ok(MOCK_MEMBERSHIP),
  updateMembershipStatus: async () => ok(MOCK_MEMBERSHIP),
  removeMembership: async () => ok(MOCK_MEMBERSHIP),
  resolveTenantContext: async () => ok(MOCK_TENANT_CONTEXT),
} satisfies TenancyService;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _authzServiceShape = {
  evaluateAccess: async () => ok({ allowed: true }),
  requirePermission: async () => ok({ allowed: true }),
  listRolePermissions: async () => ok(['business.read'] as const),
  isSensitivePermission: async () => ok(false),
} satisfies AuthzService;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _auditServiceShape = {
  createAuditEvent: async () => ok(MOCK_AUDIT_EVENT),
  findAuditEventById: async () => ok(MOCK_AUDIT_EVENT),
  listAuditEvents: async () => ok([MOCK_AUDIT_EVENT] as const),
} satisfies AuditService;

// ===========================================================================
// Runtime Tests — Error Code Constants
// ===========================================================================

describe('Identity Service Interface', () => {
  it('IDENTITY_ERROR_CODES includes USER_NOT_FOUND', () => {
    expect(IDENTITY_ERROR_CODES).toContain('USER_NOT_FOUND');
  });

  it('IDENTITY_ERROR_CODES includes SESSION_EXPIRED', () => {
    expect(IDENTITY_ERROR_CODES).toContain('SESSION_EXPIRED');
  });

  it('IDENTITY_ERROR_CODES includes all expected codes', () => {
    expect(IDENTITY_ERROR_CODES).toEqual([
      'USER_NOT_FOUND',
      'USER_EMAIL_ALREADY_EXISTS',
      'SESSION_NOT_FOUND',
      'SESSION_REVOKED',
      'SESSION_EXPIRED',
      'INVALID_IDENTITY_INPUT',
    ]);
  });
});

describe('Tenancy Service Interface', () => {
  it('TENANCY_ERROR_CODES includes BUSINESS_NOT_FOUND', () => {
    expect(TENANCY_ERROR_CODES).toContain('BUSINESS_NOT_FOUND');
  });

  it('TENANCY_ERROR_CODES includes TENANT_ACCESS_DENIED', () => {
    expect(TENANCY_ERROR_CODES).toContain('TENANT_ACCESS_DENIED');
  });

  it('TENANCY_ERROR_CODES includes all expected codes', () => {
    expect(TENANCY_ERROR_CODES).toEqual([
      'BUSINESS_NOT_FOUND',
      'BUSINESS_SLUG_ALREADY_EXISTS',
      'MEMBERSHIP_NOT_FOUND',
      'MEMBERSHIP_ALREADY_EXISTS',
      'MEMBERSHIP_INACTIVE',
      'LAST_OWNER_REMOVAL_DENIED',
      'INVALID_TENANCY_INPUT',
      'TENANT_ACCESS_DENIED',
    ]);
  });
});

describe('Authz Service Interface', () => {
  it('AUTHZ_ERROR_CODES includes ACCESS_DENIED', () => {
    expect(AUTHZ_ERROR_CODES).toContain('ACCESS_DENIED');
  });

  it('AUTHZ_ERROR_CODES includes UNKNOWN_PERMISSION', () => {
    expect(AUTHZ_ERROR_CODES).toContain('UNKNOWN_PERMISSION');
  });

  it('AUTHZ_ERROR_CODES includes all expected codes', () => {
    expect(AUTHZ_ERROR_CODES).toEqual([
      'ACCESS_DENIED',
      'UNKNOWN_PERMISSION',
      'INVALID_AUTHZ_INPUT',
    ]);
  });
});

describe('Audit Service Interface', () => {
  it('AUDIT_ERROR_CODES includes AUDIT_EVENT_NOT_FOUND', () => {
    expect(AUDIT_ERROR_CODES).toContain('AUDIT_EVENT_NOT_FOUND');
  });

  it('AUDIT_ERROR_CODES includes AUDIT_WRITE_FAILED', () => {
    expect(AUDIT_ERROR_CODES).toContain('AUDIT_WRITE_FAILED');
  });

  it('AUDIT_ERROR_CODES includes all expected codes', () => {
    expect(AUDIT_ERROR_CODES).toEqual([
      'AUDIT_EVENT_NOT_FOUND',
      'INVALID_AUDIT_INPUT',
      'AUDIT_WRITE_FAILED',
    ]);
  });
});

describe('Service Interface Domain Exports', () => {
  it('identity domain exports service constants', async () => {
    const identity = await import('../../src/domains/identity');
    expect(identity.IDENTITY_ERROR_CODES).toBeDefined();
  });

  it('tenancy domain exports service constants', async () => {
    const tenancy = await import('../../src/domains/tenancy');
    expect(tenancy.TENANCY_ERROR_CODES).toBeDefined();
  });

  it('authz domain exports service constants', async () => {
    const authz = await import('../../src/domains/authz');
    expect(authz.AUTHZ_ERROR_CODES).toBeDefined();
  });

  it('audit domain exports service constants', async () => {
    const audit = await import('../../src/domains/audit');
    expect(audit.AUDIT_ERROR_CODES).toBeDefined();
  });
});
