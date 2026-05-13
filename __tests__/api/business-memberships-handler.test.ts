import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGetBusinessMembershipsHandler,
  createPostBusinessMembershipsHandler,
  createPatchMembershipRoleHandler,
  createPatchMembershipStatusHandler,
  createDeleteMembershipHandler,
  createBusinessMembershipHandlers,
} from '@/app/api/businesses/[businessId]/memberships/handler';
import {
  createTenantRequestContext,
  type TenantRequestContext,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import { apiError } from '@/app/api/_shared/responses';
import { makeJsonRequest } from '@/app/api/_shared/request';
import { ok, err } from '@/lib/result';
import { API_HANDLERS_FEATURE_FLAG } from '@/app/api/_shared/feature-gate';
import {
  DEV_AUTH_CONTEXT_FEATURE_FLAG,
  DEV_AUTH_HEADERS,
} from '@/app/api/_shared/auth-context-adapter';
import type { BusinessMembershipIdentity } from '@/domains/tenancy/types';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_USER_ID = '22222222-2222-4222-8222-222222222222';
const BUSINESS_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_BIZ_ID = '55555555-5555-4555-8555-555555555555';
const MEMBERSHIP_ID = '66666666-6666-4666-8666-666666666666';

const MOCK_MEMBERSHIP: BusinessMembershipIdentity = {
  id: MEMBERSHIP_ID, businessId: BUSINESS_ID, userId: TARGET_USER_ID,
  role: 'VIEWER', status: 'INVITED', invitedByUserId: USER_ID,
  joinedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('@/app/api/_shared/composition', () => ({
  getApiDependencies: () => ({
    services: {
      tenancy: {
        createMembership: vi.fn().mockResolvedValue(ok(MOCK_MEMBERSHIP)),
        findMembershipById: vi.fn().mockResolvedValue(ok(MOCK_MEMBERSHIP)),
        listBusinessMemberships: vi.fn().mockResolvedValue(ok([MOCK_MEMBERSHIP])),
        updateMembershipRole: vi.fn().mockResolvedValue(ok({ ...MOCK_MEMBERSHIP, role: 'ADMIN' })),
        updateMembershipStatus: vi.fn().mockResolvedValue(ok({ ...MOCK_MEMBERSHIP, status: 'ACTIVE' })),
        removeMembership: vi.fn().mockResolvedValue(ok(MOCK_MEMBERSHIP)),
      },
      authz: { requirePermission: vi.fn().mockResolvedValue(ok({ allowed: true })) },
    },
  }),
}));

function mockSvc() {
  return {
    tenancyService: {
      createMembership: vi.fn(), findMembershipById: vi.fn(),
      listBusinessMemberships: vi.fn(), updateMembershipRole: vi.fn(),
      updateMembershipStatus: vi.fn(), removeMembership: vi.fn(),
    },
    authzService: { requirePermission: vi.fn() },
  };
}

function okTenant(opts: { userId?: string; businessId?: string; membershipId?: string; role?: 'OWNER'|'ADMIN'|'OPERATOR'|'VIEWER' } = {}): (r: Request) => Promise<ContextResult<TenantRequestContext>> {
  return async () => ({ ok: true as const, context: createTenantRequestContext({ requestId: null, tenant: { userId: opts.userId ?? USER_ID, businessId: opts.businessId ?? BUSINESS_ID, membershipId: opts.membershipId ?? MEMBERSHIP_ID, role: opts.role ?? 'OWNER' } }) });
}

function failCtx<T>(): (r: Request) => Promise<ContextResult<T>> {
  return async () => ({ ok: false as const, response: apiError('AUTH_CONTEXT_UNAVAILABLE', 'Auth unavailable', 501) });
}

let pA: string|undefined, pD: string|undefined;
beforeEach(() => { pA = process.env[API_HANDLERS_FEATURE_FLAG]; pD = process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; delete process.env[API_HANDLERS_FEATURE_FLAG]; delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; });
afterEach(() => { if (pA !== undefined) process.env[API_HANDLERS_FEATURE_FLAG] = pA; else delete process.env[API_HANDLERS_FEATURE_FLAG]; if (pD !== undefined) process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = pD; else delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; });

const P = { businessId: BUSINESS_ID };
const PM = { businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID };
const devH = { [DEV_AUTH_HEADERS.userId]: USER_ID, [DEV_AUTH_HEADERS.businessId]: BUSINESS_ID, [DEV_AUTH_HEADERS.membershipId]: MEMBERSHIP_ID, [DEV_AUTH_HEADERS.role]: 'OWNER' };

describe('LIST handler', () => {
  it('returns 501 when context fails', async () => { const s = mockSvc(); const h = createGetBusinessMembershipsHandler({ ...s, resolveTenantContext: failCtx() }); const r = await h(new Request('http://x'), P); expect(r.status).toBe(501); expect(s.tenancyService.listBusinessMemberships).not.toHaveBeenCalled(); });
  it('rejects invalid businessId', async () => { const s = mockSvc(); const h = createGetBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), { businessId: 'bad' }); expect(r.status).toBe(400); });
  it('rejects businessId mismatch', async () => { const s = mockSvc(); const h = createGetBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), { businessId: OTHER_BIZ_ID }); expect(r.status).toBe(403); expect((await r.json()).error.code).toBe('TENANT_ACCESS_DENIED'); });
  it('returns ACCESS_DENIED when authz denies', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: false })); const h = createGetBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), P); expect(r.status).toBe(403); });
  it('lists memberships with includeRemoved false', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.listBusinessMemberships.mockResolvedValue(ok([MOCK_MEMBERSHIP])); const h = createGetBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), P); expect(r.status).toBe(200); expect(s.tenancyService.listBusinessMemberships).toHaveBeenCalledWith({ businessId: BUSINESS_ID, includeRemoved: false }); });
  it('parses includeRemoved=true', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.listBusinessMemberships.mockResolvedValue(ok([])); const h = createGetBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x?includeRemoved=true'), P); expect(s.tenancyService.listBusinessMemberships).toHaveBeenCalledWith({ businessId: BUSINESS_ID, includeRemoved: true }); });
});

describe('CREATE handler', () => {
  it('returns 501 when context fails', async () => { const s = mockSvc(); const h = createPostBusinessMembershipsHandler({ ...s, resolveTenantContext: failCtx() }); const r = await h(makeJsonRequest({ userId: TARGET_USER_ID }), P); expect(r.status).toBe(501); expect(s.tenancyService.createMembership).not.toHaveBeenCalled(); });
  it('rejects invalid body', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); const h = createPostBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({}), P); expect(r.status).toBe(400); });
  it('rejects businessId mismatch', async () => { const s = mockSvc(); const h = createPostBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ userId: TARGET_USER_ID }), { businessId: OTHER_BIZ_ID }); expect(r.status).toBe(403); });
  it('returns ACCESS_DENIED when authz denies', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: false })); const h = createPostBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ userId: TARGET_USER_ID }), P); expect(r.status).toBe(403); });
  it('creates membership with route businessId and context invitedByUserId', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.createMembership.mockResolvedValue(ok(MOCK_MEMBERSHIP)); const h = createPostBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ userId: TARGET_USER_ID }), P); expect(r.status).toBe(200); const a = s.tenancyService.createMembership.mock.calls[0][0]; expect(a.businessId).toBe(BUSINESS_ID); expect(a.invitedByUserId).toBe(USER_ID); });
  it('passes MEMBERSHIP_ALREADY_EXISTS through', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.createMembership.mockResolvedValue(err('MEMBERSHIP_ALREADY_EXISTS', 'Exists')); const h = createPostBusinessMembershipsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ userId: TARGET_USER_ID }), P); expect(r.status).toBe(409); });
});

describe('UPDATE ROLE handler', () => {
  it('returns 501 when context fails', async () => { const s = mockSvc(); const h = createPatchMembershipRoleHandler({ ...s, resolveTenantContext: failCtx() }); const r = await h(makeJsonRequest({ role: 'ADMIN' }), PM); expect(r.status).toBe(501); });
  it('rejects invalid params', async () => { const s = mockSvc(); const h = createPatchMembershipRoleHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ role: 'ADMIN' }), { businessId: 'x', membershipId: 'y' }); expect(r.status).toBe(400); });
  it('returns ACCESS_DENIED when authz denies', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: false })); const h = createPatchMembershipRoleHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ role: 'ADMIN' }), PM); expect(r.status).toBe(403); });
  it('returns MEMBERSHIP_NOT_FOUND', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok(null)); const h = createPatchMembershipRoleHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ role: 'ADMIN' }), PM); expect(r.status).toBe(404); });
  it('rejects membership business mismatch', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok({ ...MOCK_MEMBERSHIP, businessId: OTHER_BIZ_ID })); const h = createPatchMembershipRoleHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ role: 'ADMIN' }), PM); expect(r.status).toBe(403); expect(s.tenancyService.updateMembershipRole).not.toHaveBeenCalled(); });
  it('updates role after ownership check', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok(MOCK_MEMBERSHIP)); s.tenancyService.updateMembershipRole.mockResolvedValue(ok({ ...MOCK_MEMBERSHIP, role: 'ADMIN' })); const h = createPatchMembershipRoleHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ role: 'ADMIN' }), PM); expect(r.status).toBe(200); expect(s.tenancyService.updateMembershipRole).toHaveBeenCalledWith({ membershipId: MEMBERSHIP_ID, role: 'ADMIN' }); });
  it('passes service error through', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok(MOCK_MEMBERSHIP)); s.tenancyService.updateMembershipRole.mockResolvedValue(err('TENANCY_REPOSITORY_ERROR', 'fail')); const h = createPatchMembershipRoleHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ role: 'ADMIN' }), PM); expect(r.status).toBe(500); });
});

describe('UPDATE STATUS handler', () => {
  it('returns 501 when context fails', async () => { const s = mockSvc(); const h = createPatchMembershipStatusHandler({ ...s, resolveTenantContext: failCtx() }); const r = await h(makeJsonRequest({ status: 'ACTIVE' }), PM); expect(r.status).toBe(501); });
  it('rejects invalid body', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); const h = createPatchMembershipStatusHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({}), PM); expect(r.status).toBe(400); });
  it('returns MEMBERSHIP_NOT_FOUND', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok(null)); const h = createPatchMembershipStatusHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ status: 'ACTIVE' }), PM); expect(r.status).toBe(404); });
  it('rejects membership business mismatch', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok({ ...MOCK_MEMBERSHIP, businessId: OTHER_BIZ_ID })); const h = createPatchMembershipStatusHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ status: 'ACTIVE' }), PM); expect(r.status).toBe(403); });
  it('updates status after ownership check', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok(MOCK_MEMBERSHIP)); s.tenancyService.updateMembershipStatus.mockResolvedValue(ok({ ...MOCK_MEMBERSHIP, status: 'ACTIVE' })); const h = createPatchMembershipStatusHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(makeJsonRequest({ status: 'ACTIVE' }), PM); expect(r.status).toBe(200); });
});

describe('DELETE handler', () => {
  it('returns 501 when context fails', async () => { const s = mockSvc(); const h = createDeleteMembershipHandler({ ...s, resolveTenantContext: failCtx() }); const r = await h(new Request('http://x', { method: 'DELETE' }), PM); expect(r.status).toBe(501); });
  it('rejects invalid params', async () => { const s = mockSvc(); const h = createDeleteMembershipHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x', { method: 'DELETE' }), { businessId: 'x', membershipId: 'y' }); expect(r.status).toBe(400); });
  it('returns ACCESS_DENIED when authz denies', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: false })); const h = createDeleteMembershipHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x', { method: 'DELETE' }), PM); expect(r.status).toBe(403); });
  it('returns MEMBERSHIP_NOT_FOUND', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok(null)); const h = createDeleteMembershipHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x', { method: 'DELETE' }), PM); expect(r.status).toBe(404); });
  it('rejects membership business mismatch', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok({ ...MOCK_MEMBERSHIP, businessId: OTHER_BIZ_ID })); const h = createDeleteMembershipHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x', { method: 'DELETE' }), PM); expect(r.status).toBe(403); });
  it('calls removeMembership with context userId', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok(MOCK_MEMBERSHIP)); s.tenancyService.removeMembership.mockResolvedValue(ok(MOCK_MEMBERSHIP)); const h = createDeleteMembershipHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x', { method: 'DELETE' }), PM); expect(r.status).toBe(200); expect(s.tenancyService.removeMembership).toHaveBeenCalledWith({ membershipId: MEMBERSHIP_ID, removedByUserId: USER_ID }); });
  it('passes LAST_OWNER_REMOVAL_DENIED through', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.tenancyService.findMembershipById.mockResolvedValue(ok(MOCK_MEMBERSHIP)); s.tenancyService.removeMembership.mockResolvedValue(err('LAST_OWNER_REMOVAL_DENIED', 'Last owner')); const h = createDeleteMembershipHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x', { method: 'DELETE' }), PM); expect(r.status).toBe(409); });
});

describe('createBusinessMembershipHandlers', () => {
  it('returns all handler functions', () => { const s = mockSvc(); const h = createBusinessMembershipHandlers(s); expect(typeof h.LIST).toBe('function'); expect(typeof h.CREATE).toBe('function'); expect(typeof h.UPDATE_ROLE).toBe('function'); expect(typeof h.UPDATE_STATUS).toBe('function'); expect(typeof h.DELETE).toBe('function'); });
});

describe('Route gate — disabled', () => {
  it('GET memberships 501', async () => { const { GET } = await import('@/app/api/businesses/[businessId]/memberships/route'); const r = await GET(new Request('http://x'), { params: Promise.resolve({ businessId: BUSINESS_ID }) }); expect(r.status).toBe(501); expect((await r.json()).error.code).toBe('NOT_IMPLEMENTED'); });
  it('POST memberships 501', async () => { const { POST } = await import('@/app/api/businesses/[businessId]/memberships/route'); const r = await POST(makeJsonRequest({ userId: TARGET_USER_ID }), { params: Promise.resolve({ businessId: BUSINESS_ID }) }); expect(r.status).toBe(501); });
  it('PATCH role 501', async () => { const { PATCH } = await import('@/app/api/businesses/[businessId]/memberships/[membershipId]/role/route'); const r = await PATCH(makeJsonRequest({ role: 'ADMIN' }), { params: Promise.resolve({ businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID }) }); expect(r.status).toBe(501); });
  it('PATCH status 501', async () => { const { PATCH } = await import('@/app/api/businesses/[businessId]/memberships/[membershipId]/status/route'); const r = await PATCH(makeJsonRequest({ status: 'ACTIVE' }), { params: Promise.resolve({ businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID }) }); expect(r.status).toBe(501); });
  it('DELETE membership 501', async () => { const { DELETE } = await import('@/app/api/businesses/[businessId]/memberships/[membershipId]/route'); const r = await DELETE(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID }) }); expect(r.status).toBe(501); });
});

describe('Route gate — enabled no dev auth', () => {
  it('GET memberships AUTH_CONTEXT_UNAVAILABLE', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; const { GET } = await import('@/app/api/businesses/[businessId]/memberships/route'); const r = await GET(new Request('http://x'), { params: Promise.resolve({ businessId: BUSINESS_ID }) }); expect(r.status).toBe(501); expect((await r.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE'); });
  it('POST memberships AUTH_CONTEXT_UNAVAILABLE', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; const { POST } = await import('@/app/api/businesses/[businessId]/memberships/route'); const r = await POST(makeJsonRequest({ userId: TARGET_USER_ID }), { params: Promise.resolve({ businessId: BUSINESS_ID }) }); expect(r.status).toBe(501); });
  it('PATCH role AUTH_CONTEXT_UNAVAILABLE', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; const { PATCH } = await import('@/app/api/businesses/[businessId]/memberships/[membershipId]/role/route'); const r = await PATCH(makeJsonRequest({ role: 'ADMIN' }), { params: Promise.resolve({ businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID }) }); expect(r.status).toBe(501); });
  it('PATCH status AUTH_CONTEXT_UNAVAILABLE', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; const { PATCH } = await import('@/app/api/businesses/[businessId]/memberships/[membershipId]/status/route'); const r = await PATCH(makeJsonRequest({ status: 'ACTIVE' }), { params: Promise.resolve({ businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID }) }); expect(r.status).toBe(501); });
  it('DELETE membership AUTH_CONTEXT_UNAVAILABLE', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; const { DELETE } = await import('@/app/api/businesses/[businessId]/memberships/[membershipId]/route'); const r = await DELETE(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID }) }); expect(r.status).toBe(501); });
});

describe('Route gate — enabled with dev auth', () => {
  it('GET memberships ok', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true'; const { GET } = await import('@/app/api/businesses/[businessId]/memberships/route'); const r = await GET(new Request('http://x', { headers: devH }), { params: Promise.resolve({ businessId: BUSINESS_ID }) }); expect(r.status).toBe(200); });
  it('POST memberships ok', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true'; const { POST } = await import('@/app/api/businesses/[businessId]/memberships/route'); const r = await POST(makeJsonRequest({ userId: TARGET_USER_ID }, { headers: devH }), { params: Promise.resolve({ businessId: BUSINESS_ID }) }); expect(r.status).toBe(200); });
  it('PATCH role ok', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true'; const { PATCH } = await import('@/app/api/businesses/[businessId]/memberships/[membershipId]/role/route'); const r = await PATCH(makeJsonRequest({ role: 'ADMIN' }, { headers: devH }), { params: Promise.resolve({ businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID }) }); expect(r.status).toBe(200); });
  it('PATCH status ok', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true'; const { PATCH } = await import('@/app/api/businesses/[businessId]/memberships/[membershipId]/status/route'); const r = await PATCH(makeJsonRequest({ status: 'ACTIVE' }, { headers: devH }), { params: Promise.resolve({ businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID }) }); expect(r.status).toBe(200); });
  it('DELETE membership ok', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true'; const { DELETE } = await import('@/app/api/businesses/[businessId]/memberships/[membershipId]/route'); const r = await DELETE(new Request('http://x', { method: 'DELETE', headers: devH }), { params: Promise.resolve({ businessId: BUSINESS_ID, membershipId: MEMBERSHIP_ID }) }); expect(r.status).toBe(200); });
});

const ROOT = path.resolve(__dirname, '../..');
const FORBID_ROUTE = ['getPrisma','PrismaClient','repository','middleware','clerk','next-auth','supabase','jwt','cookie'];
const FORBID_HANDLER = [...FORBID_ROUTE, 'getApiDependencies'];

describe('Scope guards', () => {
  it('memberships route.ts clean', () => { const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/memberships/route.ts'), 'utf-8'); for (const f of FORBID_ROUTE) expect(c).not.toContain(f); });
  it('role route.ts clean', () => { const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/memberships/[membershipId]/role/route.ts'), 'utf-8'); for (const f of FORBID_ROUTE) expect(c).not.toContain(f); });
  it('status route.ts clean', () => { const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/memberships/[membershipId]/status/route.ts'), 'utf-8'); for (const f of FORBID_ROUTE) expect(c).not.toContain(f); });
  it('delete route.ts clean', () => { const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/memberships/[membershipId]/route.ts'), 'utf-8'); for (const f of FORBID_ROUTE) expect(c).not.toContain(f); });
  it('handler.ts clean', () => { const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/memberships/handler.ts'), 'utf-8'); for (const f of FORBID_HANDLER) expect(c).not.toContain(f); });
  it('non-membership placeholders unchanged', () => { for (const p of ['src/app/api/identity/users/[userId]/route.ts']) { const c = fs.readFileSync(path.join(ROOT, p), 'utf-8'); expect(c).toContain('createPlaceholderRoute'); } });
});
