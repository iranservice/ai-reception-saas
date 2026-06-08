import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGetOperatorWorkloadHandler,
  type OperatorWorkloadHandlerDeps,
  type OperatorWorkloadResponse,
} from '@/app/api/businesses/[businessId]/dashboard/operator-workload/handler';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID_2 = '22222222-2222-4222-8222-222222222222';
const USER_ID_3 = '33333333-3333-4333-8333-333333333333';
const BIZ_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_BIZ = '55555555-5555-4555-8555-555555555555';
const MEM_ID = '66666666-6666-4666-8666-666666666666';

// ---------------------------------------------------------------------------
// Mock composition (for route integration tests)
// ---------------------------------------------------------------------------

vi.mock('@/app/api/_shared/composition', () => ({
  getApiDependencies: () => ({
    repositories: {
      conversations: {
        getWorkloadByAssignee: vi.fn().mockResolvedValue(ok([])),
        getResolvedTodayByAssignee: vi.fn().mockResolvedValue(ok([])),
        countUnassignedOpen: vi.fn().mockResolvedValue(ok(0)),
      },
      tenancy: {
        listBusinessMemberships: vi.fn().mockResolvedValue(ok([])),
      },
    },
    services: {
      authz: { requirePermission: vi.fn().mockResolvedValue(ok({ allowed: true })) },
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

type Role = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

function mockDeps(): OperatorWorkloadHandlerDeps & {
  conversationRepository: {
    getWorkloadByAssignee: ReturnType<typeof vi.fn>;
    getResolvedTodayByAssignee: ReturnType<typeof vi.fn>;
    countUnassignedOpen: ReturnType<typeof vi.fn>;
  };
  tenancyRepository: {
    listBusinessMemberships: ReturnType<typeof vi.fn>;
  };
  authzService: {
    requirePermission: ReturnType<typeof vi.fn>;
  };
} {
  return {
    conversationRepository: {
      getWorkloadByAssignee: vi.fn().mockResolvedValue(ok([])),
      getResolvedTodayByAssignee: vi.fn().mockResolvedValue(ok([])),
      countUnassignedOpen: vi.fn().mockResolvedValue(ok(0)),
    },
    tenancyRepository: {
      listBusinessMemberships: vi.fn().mockResolvedValue(ok([])),
    },
    authzService: {
      requirePermission: vi.fn().mockResolvedValue(ok({ allowed: true })),
    },
  };
}

function okTenant(opts: { userId?: string; businessId?: string; membershipId?: string; role?: Role } = {}): (r: Request) => Promise<ContextResult<TenantRequestContext>> {
  return async () => ({ ok: true as const, context: createTenantRequestContext({ requestId: null, tenant: { userId: opts.userId ?? USER_ID, businessId: opts.businessId ?? BIZ_ID, membershipId: opts.membershipId ?? MEM_ID, role: opts.role ?? 'OWNER' } }) });
}

function failCtx<T>(): (r: Request) => Promise<ContextResult<T>> {
  return async () => ({ ok: false as const, response: apiError('AUTH_CONTEXT_UNAVAILABLE', 'Auth unavailable', 501) });
}

/** Creates a mock membership identity with user display info */
function mockMember(userId: string, name: string, role: Role = 'OPERATOR', avatarUrl: string | null = null) {
  return {
    id: `mem-${userId.slice(0, 8)}`,
    businessId: BIZ_ID,
    userId,
    role,
    status: 'ACTIVE' as const,
    invitedByUserId: null,
    joinedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    user: { id: userId, name, avatarUrl },
  };
}

// ---------------------------------------------------------------------------
// Feature flag save/restore
// ---------------------------------------------------------------------------

let pA: string | undefined, pD: string | undefined;
beforeEach(() => { pA = process.env[API_HANDLERS_FEATURE_FLAG]; pD = process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; delete process.env[API_HANDLERS_FEATURE_FLAG]; delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; });
afterEach(() => { if (pA !== undefined) process.env[API_HANDLERS_FEATURE_FLAG] = pA; else delete process.env[API_HANDLERS_FEATURE_FLAG]; if (pD !== undefined) process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = pD; else delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; });

const P = { businessId: BIZ_ID };
const devH = { [DEV_AUTH_HEADERS.userId]: USER_ID, [DEV_AUTH_HEADERS.businessId]: BIZ_ID, [DEV_AUTH_HEADERS.membershipId]: MEM_ID, [DEV_AUTH_HEADERS.role]: 'OWNER' };

// ===========================================================================
// Handler tests
// ===========================================================================

describe('Operator Workload Handler', () => {
  // -------------------------------------------------------------------------
  // Authentication & Authorization
  // -------------------------------------------------------------------------

  it('returns 501 when context fails', async () => {
    const d = mockDeps();
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: failCtx() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(501);
    expect(d.conversationRepository.getWorkloadByAssignee).not.toHaveBeenCalled();
    expect(d.authzService.requirePermission).not.toHaveBeenCalled();
  });

  it('rejects invalid businessId', async () => {
    const d = mockDeps();
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), { businessId: 'bad' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe('INVALID_WORKLOAD_INPUT');
  });

  it('rejects businessId mismatch (cross-tenant)', async () => {
    const d = mockDeps();
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), { businessId: OTHER_BIZ });
    expect(r.status).toBe(403);
    expect(d.authzService.requirePermission).not.toHaveBeenCalled();
  });

  it('returns ACCESS_DENIED when authz denies', async () => {
    const d = mockDeps();
    d.authzService.requirePermission.mockResolvedValue(ok({ allowed: false }));
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(403);
    expect(d.conversationRepository.getWorkloadByAssignee).not.toHaveBeenCalled();
  });

  it('passes authz error through', async () => {
    const d = mockDeps();
    d.authzService.requirePermission.mockResolvedValue(err('INTERNAL_SERVER_ERROR', 'fail'));
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(500);
    expect(d.conversationRepository.getWorkloadByAssignee).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // RBAC: All roles with conversations.read see the same workload
  // -------------------------------------------------------------------------

  it.each<Role>(['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'])(
    '%s gets 200 with empty workload',
    async (role) => {
      const d = mockDeps();
      const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant({ role }) });
      const r = await h(new Request('http://x'), P);
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body.ok).toBe(true);
      const data: OperatorWorkloadResponse = body.data;
      expect(data.operators).toEqual([]);
      expect(data.unassigned.open).toBe(0);
      expect(data.businessId).toBe(BIZ_ID);
      expect(typeof data.generatedAt).toBe('string');
    },
  );

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('returns empty operators + zero unassigned when no conversations exist', async () => {
    const d = mockDeps();
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(200);
    const data: OperatorWorkloadResponse = (await r.json()).data;
    expect(data.operators).toHaveLength(0);
    expect(data.unassigned.open).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Populated workload
  // -------------------------------------------------------------------------

  it('returns operators with correct counts and display info', async () => {
    const d = mockDeps();
    d.conversationRepository.getWorkloadByAssignee.mockResolvedValue(ok([
      { assignedUserId: USER_ID, openCount: 5 },
      { assignedUserId: USER_ID_2, openCount: 3 },
    ]));
    d.conversationRepository.getResolvedTodayByAssignee.mockResolvedValue(ok([
      { assignedUserId: USER_ID, resolvedCount: 2 },
    ]));
    d.conversationRepository.countUnassignedOpen.mockResolvedValue(ok(7));
    d.tenancyRepository.listBusinessMemberships.mockResolvedValue(ok([
      mockMember(USER_ID, 'Alice', 'ADMIN'),
      mockMember(USER_ID_2, 'Bob', 'OPERATOR'),
    ]));

    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(200);
    const data: OperatorWorkloadResponse = (await r.json()).data;

    expect(data.operators).toHaveLength(2);
    // Sorted by openAssigned descending
    expect(data.operators[0].userId).toBe(USER_ID);
    expect(data.operators[0].name).toBe('Alice');
    expect(data.operators[0].role).toBe('ADMIN');
    expect(data.operators[0].openAssigned).toBe(5);
    expect(data.operators[0].resolvedToday).toBe(2);

    expect(data.operators[1].userId).toBe(USER_ID_2);
    expect(data.operators[1].name).toBe('Bob');
    expect(data.operators[1].role).toBe('OPERATOR');
    expect(data.operators[1].openAssigned).toBe(3);
    expect(data.operators[1].resolvedToday).toBe(0);

    expect(data.unassigned.open).toBe(7);
  });

  // -------------------------------------------------------------------------
  // Unassigned only (no operators have assignments)
  // -------------------------------------------------------------------------

  it('returns empty operators but populated unassigned', async () => {
    const d = mockDeps();
    d.conversationRepository.countUnassignedOpen.mockResolvedValue(ok(12));
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(200);
    const data: OperatorWorkloadResponse = (await r.json()).data;
    expect(data.operators).toHaveLength(0);
    expect(data.unassigned.open).toBe(12);
  });

  // -------------------------------------------------------------------------
  // Resolved-today only (operator resolved but has no open)
  // -------------------------------------------------------------------------

  it('includes operator with only resolved-today count', async () => {
    const d = mockDeps();
    d.conversationRepository.getWorkloadByAssignee.mockResolvedValue(ok([]));
    d.conversationRepository.getResolvedTodayByAssignee.mockResolvedValue(ok([
      { assignedUserId: USER_ID_3, resolvedCount: 4 },
    ]));
    d.tenancyRepository.listBusinessMemberships.mockResolvedValue(ok([
      mockMember(USER_ID_3, 'Charlie', 'OPERATOR'),
    ]));

    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(200);
    const data: OperatorWorkloadResponse = (await r.json()).data;
    expect(data.operators).toHaveLength(1);
    expect(data.operators[0].userId).toBe(USER_ID_3);
    expect(data.operators[0].openAssigned).toBe(0);
    expect(data.operators[0].resolvedToday).toBe(4);
  });

  // -------------------------------------------------------------------------
  // Unknown assignee (not in active members)
  // -------------------------------------------------------------------------

  it('falls back to truncated userId when member not found', async () => {
    const d = mockDeps();
    d.conversationRepository.getWorkloadByAssignee.mockResolvedValue(ok([
      { assignedUserId: USER_ID_3, openCount: 1 },
    ]));
    d.tenancyRepository.listBusinessMemberships.mockResolvedValue(ok([]));

    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(200);
    const data: OperatorWorkloadResponse = (await r.json()).data;
    expect(data.operators).toHaveLength(1);
    expect(data.operators[0].name).toBe(USER_ID_3.slice(0, 8));
    expect(data.operators[0].role).toBe('OPERATOR');
  });

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------

  it('sorts operators by openAssigned descending then by name ascending', async () => {
    const d = mockDeps();
    d.conversationRepository.getWorkloadByAssignee.mockResolvedValue(ok([
      { assignedUserId: USER_ID, openCount: 3 },
      { assignedUserId: USER_ID_2, openCount: 3 },
      { assignedUserId: USER_ID_3, openCount: 5 },
    ]));
    d.tenancyRepository.listBusinessMemberships.mockResolvedValue(ok([
      mockMember(USER_ID, 'Zara', 'OPERATOR'),
      mockMember(USER_ID_2, 'Alice', 'OPERATOR'),
      mockMember(USER_ID_3, 'Bob', 'OPERATOR'),
    ]));

    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    const data: OperatorWorkloadResponse = (await r.json()).data;

    // USER_ID_3 (5 open) first, then Alice (3 open), then Zara (3 open)
    expect(data.operators[0].name).toBe('Bob');
    expect(data.operators[1].name).toBe('Alice');
    expect(data.operators[2].name).toBe('Zara');
  });

  // -------------------------------------------------------------------------
  // businessId passed to all repo calls
  // -------------------------------------------------------------------------

  it('passes businessId to all repository calls', async () => {
    const d = mockDeps();
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    await h(new Request('http://x'), P);
    expect(d.conversationRepository.getWorkloadByAssignee).toHaveBeenCalledWith(BIZ_ID);
    expect(d.conversationRepository.getResolvedTodayByAssignee).toHaveBeenCalledWith(BIZ_ID, expect.any(Date));
    expect(d.conversationRepository.countUnassignedOpen).toHaveBeenCalledWith(BIZ_ID);
    expect(d.tenancyRepository.listBusinessMemberships).toHaveBeenCalledWith({
      businessId: BIZ_ID,
      includeRemoved: false,
    });
  });

  // -------------------------------------------------------------------------
  // Repository errors
  // -------------------------------------------------------------------------

  it('returns error when getWorkloadByAssignee fails', async () => {
    const d = mockDeps();
    d.conversationRepository.getWorkloadByAssignee.mockResolvedValue(err('CONVERSATION_REPOSITORY_ERROR', 'DB down'));
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(500);
  });

  it('returns error when countUnassignedOpen fails', async () => {
    const d = mockDeps();
    d.conversationRepository.countUnassignedOpen.mockResolvedValue(err('CONVERSATION_REPOSITORY_ERROR', 'DB down'));
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(500);
  });

  it('returns error when listBusinessMemberships fails', async () => {
    const d = mockDeps();
    d.tenancyRepository.listBusinessMemberships.mockResolvedValue(err('TENANCY_REPOSITORY_ERROR', 'DB down'));
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    expect(r.status).toBe(500);
  });

  // -------------------------------------------------------------------------
  // Response contract
  // -------------------------------------------------------------------------

  it('response includes generatedAt ISO string', async () => {
    const d = mockDeps();
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    const data = (await r.json()).data;
    const parsed = new Date(data.generatedAt);
    expect(parsed.toISOString()).toBe(data.generatedAt);
  });

  it('response includes businessId', async () => {
    const d = mockDeps();
    const h = createGetOperatorWorkloadHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(new Request('http://x'), P);
    const data = (await r.json()).data;
    expect(data.businessId).toBe(BIZ_ID);
  });
});

// ===========================================================================
// Route gate tests
// ===========================================================================

describe('Route gate — disabled', () => {
  it('GET operator-workload returns 501', async () => {
    const { GET } = await import('@/app/api/businesses/[businessId]/dashboard/operator-workload/route');
    const r = await GET(new Request('http://x'), { params: Promise.resolve({ businessId: BIZ_ID }) });
    expect(r.status).toBe(501);
    expect((await r.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
});

describe('Route gate — enabled no dev auth', () => {
  it('GET operator-workload returns AUTH_CONTEXT_UNAVAILABLE', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    const { GET } = await import('@/app/api/businesses/[businessId]/dashboard/operator-workload/route');
    const r = await GET(new Request('http://x'), { params: Promise.resolve({ businessId: BIZ_ID }) });
    expect(r.status).toBe(501);
    expect((await r.json()).error.code).toBe('AUTH_CONTEXT_UNAVAILABLE');
  });
});

describe('Route gate — enabled with dev auth', () => {
  it('GET operator-workload returns 200', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const { GET } = await import('@/app/api/businesses/[businessId]/dashboard/operator-workload/route');
    const r = await GET(new Request('http://x', { headers: devH }), { params: Promise.resolve({ businessId: BIZ_ID }) });
    expect(r.status).toBe(200);
  });
});

// ===========================================================================
// Scope guards
// ===========================================================================

const ROOT = path.resolve(__dirname, '../..');
const FORBID_ROUTE = ['getPrisma', 'PrismaClient', 'repository', 'middleware', 'clerk', 'next-auth', 'supabase', 'jwt', 'cookie'];
const FORBID_HANDLER = ['getPrisma', 'PrismaClient', 'middleware', 'clerk', 'next-auth', 'supabase', 'jwt', 'cookie', 'getApiDependencies'];

describe('Scope guards', () => {
  it('operator-workload/route.ts is clean', () => {
    const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/dashboard/operator-workload/route.ts'), 'utf-8');
    for (const f of FORBID_ROUTE) expect(c).not.toContain(f);
  });
  it('operator-workload/handler.ts is clean', () => {
    const c = fs.readFileSync(path.join(ROOT, 'src/app/api/businesses/[businessId]/dashboard/operator-workload/handler.ts'), 'utf-8');
    for (const f of FORBID_HANDLER) expect(c).not.toContain(f);
  });
});
