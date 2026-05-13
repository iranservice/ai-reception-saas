import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGetAuditEventsHandler,
  createGetAuditEventByIdHandler,
  createAuditEventHandlers,
} from '@/app/api/businesses/[businessId]/audit-events/handler';
import {
  createTenantRequestContext,
  type TenantRequestContext,
  type ContextResult,
} from '@/app/api/_shared/request-context';
import { apiError } from '@/app/api/_shared/responses';
import { ok, err } from '@/lib/result';
import { API_HANDLERS_FEATURE_FLAG } from '@/app/api/_shared/feature-gate';
import {
  DEV_AUTH_CONTEXT_FEATURE_FLAG,
  DEV_AUTH_HEADERS,
} from '@/app/api/_shared/auth-context-adapter';
import type { AuditEventIdentity } from '@/domains/audit/types';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BIZ_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_BIZ = '55555555-5555-4555-8555-555555555555';
const MEM_ID = '66666666-6666-4666-8666-666666666666';
const AUDIT_ID = '77777777-7777-4777-8777-777777777777';

const MOCK_EVENT: AuditEventIdentity = {
  id: AUDIT_ID, businessId: BIZ_ID, actorType: 'USER', actorUserId: USER_ID,
  action: 'business.update', targetType: 'business', targetId: BIZ_ID,
  result: 'SUCCESS', metadata: null, createdAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('@/app/api/_shared/composition', () => ({
  getApiDependencies: () => ({
    services: {
      audit: {
        listAuditEvents: vi.fn().mockResolvedValue(ok([MOCK_EVENT])),
        findAuditEventById: vi.fn().mockResolvedValue(ok(MOCK_EVENT)),
      },
      authz: { requirePermission: vi.fn().mockResolvedValue(ok({ allowed: true })) },
    },
  }),
}));

function mockSvc() {
  return {
    auditService: { listAuditEvents: vi.fn(), findAuditEventById: vi.fn() },
    authzService: { requirePermission: vi.fn() },
  };
}

function okTenant(opts: { userId?: string; businessId?: string; membershipId?: string; role?: 'OWNER'|'ADMIN'|'OPERATOR'|'VIEWER' } = {}): (r: Request) => Promise<ContextResult<TenantRequestContext>> {
  return async () => ({ ok: true as const, context: createTenantRequestContext({ requestId: null, tenant: { userId: opts.userId ?? USER_ID, businessId: opts.businessId ?? BIZ_ID, membershipId: opts.membershipId ?? MEM_ID, role: opts.role ?? 'OWNER' } }) });
}

function failCtx<T>(): (r: Request) => Promise<ContextResult<T>> {
  return async () => ({ ok: false as const, response: apiError('AUTH_CONTEXT_UNAVAILABLE', 'Auth unavailable', 501) });
}

let pA: string|undefined, pD: string|undefined;
beforeEach(() => { pA = process.env[API_HANDLERS_FEATURE_FLAG]; pD = process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; delete process.env[API_HANDLERS_FEATURE_FLAG]; delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; });
afterEach(() => { if (pA !== undefined) process.env[API_HANDLERS_FEATURE_FLAG] = pA; else delete process.env[API_HANDLERS_FEATURE_FLAG]; if (pD !== undefined) process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = pD; else delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; });

const P = { businessId: BIZ_ID };
const PM = { businessId: BIZ_ID, auditEventId: AUDIT_ID };
const devH = { [DEV_AUTH_HEADERS.userId]: USER_ID, [DEV_AUTH_HEADERS.businessId]: BIZ_ID, [DEV_AUTH_HEADERS.membershipId]: MEM_ID, [DEV_AUTH_HEADERS.role]: 'OWNER' };

describe('LIST handler', () => {
  it('returns 501 when context fails', async () => { const s = mockSvc(); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: failCtx() }); const r = await h(new Request('http://x'), P); expect(r.status).toBe(501); expect(s.auditService.listAuditEvents).not.toHaveBeenCalled(); expect(s.authzService.requirePermission).not.toHaveBeenCalled(); });
  it('rejects invalid businessId', async () => { const s = mockSvc(); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), { businessId: 'bad' }); expect(r.status).toBe(400); expect((await r.json()).error.code).toBe('INVALID_AUDIT_INPUT'); });
  it('rejects businessId mismatch', async () => { const s = mockSvc(); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), { businessId: OTHER_BIZ }); expect(r.status).toBe(403); expect(s.authzService.requirePermission).not.toHaveBeenCalled(); });
  it('returns ACCESS_DENIED when authz denies', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: false })); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), P); expect(r.status).toBe(403); expect(s.auditService.listAuditEvents).not.toHaveBeenCalled(); });
  it('passes authz error through', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(err('INTERNAL_SERVER_ERROR', 'fail')); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), P); expect(r.status).toBe(500); expect(s.auditService.listAuditEvents).not.toHaveBeenCalled(); });
  it('lists events with businessId scope', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.auditService.listAuditEvents.mockResolvedValue(ok([MOCK_EVENT])); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), P); expect(r.status).toBe(200); expect(s.auditService.listAuditEvents).toHaveBeenCalledWith({ businessId: BIZ_ID }); });
  it('parses valid query filters', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.auditService.listAuditEvents.mockResolvedValue(ok([])); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const url = `http://x?actorUserId=${USER_ID}&action=business.update&targetType=business&targetId=${BIZ_ID}&result=SUCCESS&actorType=USER&limit=50`; const r = await h(new Request(url), P); expect(r.status).toBe(200); expect(s.auditService.listAuditEvents).toHaveBeenCalledWith({ businessId: BIZ_ID, actorUserId: USER_ID, action: 'business.update', targetType: 'business', targetId: BIZ_ID, result: 'SUCCESS', actorType: 'USER', limit: 50 }); });
  it('rejects invalid actorUserId query', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x?actorUserId=bad'), P); expect(r.status).toBe(400); });
  it('rejects invalid result query', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x?result=INVALID'), P); expect(r.status).toBe(400); });
  it('rejects invalid actorType query', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x?actorType=UNKNOWN'), P); expect(r.status).toBe(400); });
  it('rejects invalid limit 0', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x?limit=0'), P); expect(r.status).toBe(400); });
  it('rejects invalid limit 101', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x?limit=101'), P); expect(r.status).toBe(400); });
  it('rejects non-integer limit', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); const h = createGetAuditEventsHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x?limit=abc'), P); expect(r.status).toBe(400); });
});

describe('GET BY ID handler', () => {
  it('returns 501 when context fails', async () => { const s = mockSvc(); const h = createGetAuditEventByIdHandler({ ...s, resolveTenantContext: failCtx() }); const r = await h(new Request('http://x'), PM); expect(r.status).toBe(501); expect(s.authzService.requirePermission).not.toHaveBeenCalled(); expect(s.auditService.findAuditEventById).not.toHaveBeenCalled(); });
  it('rejects invalid params', async () => { const s = mockSvc(); const h = createGetAuditEventByIdHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), { businessId: 'x', auditEventId: 'y' }); expect(r.status).toBe(400); expect((await r.json()).error.code).toBe('INVALID_AUDIT_INPUT'); });
  it('rejects businessId mismatch', async () => { const s = mockSvc(); const h = createGetAuditEventByIdHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), { businessId: OTHER_BIZ, auditEventId: AUDIT_ID }); expect(r.status).toBe(403); expect(s.authzService.requirePermission).not.toHaveBeenCalled(); });
  it('returns ACCESS_DENIED when authz denies', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: false })); const h = createGetAuditEventByIdHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), PM); expect(r.status).toBe(403); expect(s.auditService.findAuditEventById).not.toHaveBeenCalled(); });
  it('returns AUDIT_EVENT_NOT_FOUND when null', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.auditService.findAuditEventById.mockResolvedValue(ok(null)); const h = createGetAuditEventByIdHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), PM); expect(r.status).toBe(404); expect((await r.json()).error.code).toBe('AUDIT_EVENT_NOT_FOUND'); });
  it('rejects event from other business', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.auditService.findAuditEventById.mockResolvedValue(ok({ ...MOCK_EVENT, businessId: OTHER_BIZ })); const h = createGetAuditEventByIdHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), PM); expect(r.status).toBe(403); expect((await r.json()).error.code).toBe('TENANT_ACCESS_DENIED'); });
  it('rejects event with null businessId', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.auditService.findAuditEventById.mockResolvedValue(ok({ ...MOCK_EVENT, businessId: null })); const h = createGetAuditEventByIdHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), PM); expect(r.status).toBe(403); });
  it('returns event when authz allows and event belongs to business', async () => { const s = mockSvc(); s.authzService.requirePermission.mockResolvedValue(ok({ allowed: true })); s.auditService.findAuditEventById.mockResolvedValue(ok(MOCK_EVENT)); const h = createGetAuditEventByIdHandler({ ...s, resolveTenantContext: okTenant() }); const r = await h(new Request('http://x'), PM); expect(r.status).toBe(200); const b = await r.json(); expect(b.ok).toBe(true); expect(b.data.id).toBe(AUDIT_ID); });
});

describe('createAuditEventHandlers', () => {
  it('returns LIST and GET_BY_ID functions', () => { const s = mockSvc(); const h = createAuditEventHandlers(s); expect(typeof h.LIST).toBe('function'); expect(typeof h.GET_BY_ID).toBe('function'); });
});

describe('Route gate — disabled', () => {
  it('GET audit-events 501', async () => { const { GET } = await import('@/app/api/businesses/[businessId]/audit-events/route'); const r = await GET(new Request('http://x'), { params: Promise.resolve({ businessId: BIZ_ID }) }); expect(r.status).toBe(501); expect((await r.json()).error.code).toBe('NOT_IMPLEMENTED'); });
  it('GET audit-events/:id 501', async () => { const { GET } = await import('@/app/api/businesses/[businessId]/audit-events/[auditEventId]/route'); const r = await GET(new Request('http://x'), { params: Promise.resolve({ businessId: BIZ_ID, auditEventId: AUDIT_ID }) }); expect(r.status).toBe(501); expect((await r.json()).error.code).toBe('NOT_IMPLEMENTED'); });
});

describe('Route gate — enabled no dev auth', () => {
  it('GET audit-events AUTH_CONTEXT_UNAVAILABLE', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; const { GET } = await import('@/app/api/businesses/[businessId]/audit-events/route'); const r = await GET(new Request('http://x'), { params: Promise.resolve({ businessId: BIZ_ID }) }); expect(r.status).toBe(501); expect((await r.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE'); });
  it('GET audit-events/:id AUTH_CONTEXT_UNAVAILABLE', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; const { GET } = await import('@/app/api/businesses/[businessId]/audit-events/[auditEventId]/route'); const r = await GET(new Request('http://x'), { params: Promise.resolve({ businessId: BIZ_ID, auditEventId: AUDIT_ID }) }); expect(r.status).toBe(501); expect((await r.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE'); });
});

describe('Route gate — enabled with dev auth', () => {
  it('GET audit-events ok', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true'; const { GET } = await import('@/app/api/businesses/[businessId]/audit-events/route'); const r = await GET(new Request('http://x', { headers: devH }), { params: Promise.resolve({ businessId: BIZ_ID }) }); expect(r.status).toBe(200); });
  it('GET audit-events/:id ok', async () => { process.env[API_HANDLERS_FEATURE_FLAG] = 'true'; process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true'; const { GET } = await import('@/app/api/businesses/[businessId]/audit-events/[auditEventId]/route'); const r = await GET(new Request('http://x', { headers: devH }), { params: Promise.resolve({ businessId: BIZ_ID, auditEventId: AUDIT_ID }) }); expect(r.status).toBe(200); });
});

const ROOT = path.resolve(__dirname, '../..');
const FORBID_ROUTE = ['getPrisma','PrismaClient','repository','middleware','clerk','next-auth','supabase','jwt','cookie'];
const FORBID_HANDLER = [...FORBID_ROUTE, 'getApiDependencies'];

describe('Scope guards', () => {
  it('audit-events route.ts clean', () => { const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/audit-events/route.ts'), 'utf-8'); for (const f of FORBID_ROUTE) expect(c).not.toContain(f); });
  it('audit-events/[auditEventId]/route.ts clean', () => { const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/audit-events/[auditEventId]/route.ts'), 'utf-8'); for (const f of FORBID_ROUTE) expect(c).not.toContain(f); });
  it('handler.ts clean', () => { const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/audit-events/handler.ts'), 'utf-8'); for (const f of FORBID_HANDLER) expect(c).not.toContain(f); });
  it('non-audit placeholders unchanged', () => { for (const p of ['src/app/api/identity/users/[userId]/route.ts','src/app/api/authz/evaluate/route.ts']) { const c = fs.readFileSync(path.join(ROOT, p), 'utf-8'); expect(c).toContain('createPlaceholderRoute'); } });
});
