import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createCurrentDraftHandler,
  type CurrentDraftHandlerDeps,
} from '@/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/handler';
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
import {
  createReplyDraftRepository,
  type ReplyDraftRepositoryDb,
  type ReplyDraftRecord,
} from '@/domains/reply-drafts/repository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BIZ_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_BIZ = '55555555-5555-4555-8555-555555555555';
const MEM_ID = '66666666-6666-4666-8666-666666666666';
const CONV_ID = '77777777-7777-4777-8777-777777777777';
const DRAFT_ID = 'aaaa1111-1111-4111-8111-111111111111';
const OTHER_CONV_ID = '88888888-8888-4888-8888-888888888888';
const NOW = new Date('2026-01-15T12:00:00.000Z');

const DRAFT_TEXT = 'Hello, this is the full draft text for operator review';
const ORIGINAL_TEXT = 'Original generated draft text';

// ---------------------------------------------------------------------------
// Mock composition (for route integration tests)
// ---------------------------------------------------------------------------

vi.mock('@/app/api/_shared/composition', () => ({
  getApiDependencies: () => ({
    repositories: {
      replyDrafts: {
        getCurrentByConversation: vi.fn().mockResolvedValue(ok({
          draft: {
            id: DRAFT_ID,
            conversationId: CONV_ID,
            status: 'PENDING_REVIEW',
            source: 'SYSTEM',
            draftText: DRAFT_TEXT,
            draftTextPreview: DRAFT_TEXT,
            originalText: ORIGINAL_TEXT,
            reviewedAt: null,
            reviewedByUserId: null,
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
          },
        })),
      },
      conversations: {
        findConversationById: vi.fn().mockResolvedValue(ok({
          id: CONV_ID,
          businessId: BIZ_ID,
        })),
      },
    },
    services: {
      authz: { requirePermission: vi.fn().mockResolvedValue(ok({ allowed: true })) },
      audit: { createAuditEvent: vi.fn().mockResolvedValue(ok({ id: 'audit-1' })) },
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

type Role = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

function mockDeps(): CurrentDraftHandlerDeps & {
  replyDraftRepository: {
    getCurrentByConversation: ReturnType<typeof vi.fn>;
  };
  conversationRepository: {
    findConversationById: ReturnType<typeof vi.fn>;
  };
  authzService: {
    requirePermission: ReturnType<typeof vi.fn>;
  };
} {
  return {
    replyDraftRepository: {
      getCurrentByConversation: vi.fn().mockResolvedValue(ok({
        draft: {
          id: DRAFT_ID,
          conversationId: CONV_ID,
          status: 'PENDING_REVIEW',
          source: 'SYSTEM',
          draftText: DRAFT_TEXT,
          draftTextPreview: DRAFT_TEXT,
          originalText: ORIGINAL_TEXT,
          reviewedAt: null,
          reviewedByUserId: null,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      })),
    },
    conversationRepository: {
      findConversationById: vi.fn().mockResolvedValue(ok({
        id: CONV_ID,
        businessId: BIZ_ID,
      })),
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

function getRequest(): Request {
  return new Request('http://x', { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Feature flag save/restore
// ---------------------------------------------------------------------------

let pA: string | undefined, pD: string | undefined;
beforeEach(() => { pA = process.env[API_HANDLERS_FEATURE_FLAG]; pD = process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; delete process.env[API_HANDLERS_FEATURE_FLAG]; delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; });
afterEach(() => { if (pA !== undefined) process.env[API_HANDLERS_FEATURE_FLAG] = pA; else delete process.env[API_HANDLERS_FEATURE_FLAG]; if (pD !== undefined) process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = pD; else delete process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG]; });

const P = { businessId: BIZ_ID, conversationId: CONV_ID };

// ===========================================================================
// Handler tests
// ===========================================================================

describe('Current Draft Handler', () => {

  // -------------------------------------------------------------------------
  // Auth / params validation
  // -------------------------------------------------------------------------

  it('returns 501 when context fails', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: failCtx() });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(501);
  });

  it('rejects invalid businessId', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), { ...P, businessId: 'not-uuid' });
    expect(r.status).toBe(400);
  });

  it('rejects invalid conversationId', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), { ...P, conversationId: 'bad' });
    expect(r.status).toBe(400);
  });

  it('rejects businessId mismatch (cross-tenant)', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), { ...P, businessId: OTHER_BIZ });
    expect(r.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // RBAC
  // -------------------------------------------------------------------------

  it('uses ai_drafts.read permission (not generate or approve)', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    await h(getRequest(), P);
    expect(d.authzService.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'ai_drafts.read' }),
    );
  });

  it('returns ACCESS_DENIED when authz denies', async () => {
    const d = mockDeps();
    d.authzService.requirePermission.mockResolvedValue(ok({ allowed: false }));
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(403);
  });

  it('passes authz error through', async () => {
    const d = mockDeps();
    d.authzService.requirePermission.mockResolvedValue(err('AUTHZ_ERROR', 'Authz error'));
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('OWNER gets 200', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant({ role: 'OWNER' }) });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(200);
  });

  it('ADMIN gets 200', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant({ role: 'ADMIN' }) });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(200);
  });

  it('OPERATOR gets 200', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant({ role: 'OPERATOR' }) });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Conversation validation
  // -------------------------------------------------------------------------

  it('returns 404 when conversation not found', async () => {
    const d = mockDeps();
    d.conversationRepository.findConversationById.mockResolvedValue(ok(null));
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(404);
    const body = await r.json();
    expect(body.error.code).toBe('CONVERSATION_NOT_FOUND');
  });

  it('returns error when conversation lookup fails', async () => {
    const d = mockDeps();
    d.conversationRepository.findConversationById.mockResolvedValue(err('DB_ERROR', 'DB error'));
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  // -------------------------------------------------------------------------
  // Current draft read
  // -------------------------------------------------------------------------

  it('returns draft: null when no active draft exists', async () => {
    const d = mockDeps();
    d.replyDraftRepository.getCurrentByConversation.mockResolvedValue(ok({ draft: null }));
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.draft).toBeNull();
    expect(body.data.businessId).toBe(BIZ_ID);
    expect(body.data.conversationId).toBe(CONV_ID);
  });

  it('returns PENDING_REVIEW draft with full draftText', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.draft.status).toBe('PENDING_REVIEW');
    expect(body.data.draft.draftText).toBe(DRAFT_TEXT);
    expect(body.data.draft.source).toBe('SYSTEM');
    expect(body.data.draft.id).toBe(DRAFT_ID);
    expect(body.data.draft.conversationId).toBe(CONV_ID);
  });

  it('returns EDITED draft with full draftText', async () => {
    const d = mockDeps();
    d.replyDraftRepository.getCurrentByConversation.mockResolvedValue(ok({
      draft: {
        id: DRAFT_ID,
        conversationId: CONV_ID,
        status: 'EDITED',
        source: 'SYSTEM',
        draftText: 'Edited version of the text',
        draftTextPreview: 'Edited version of the text',
        originalText: ORIGINAL_TEXT,
        reviewedAt: null,
        reviewedByUserId: null,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    }));
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.draft.status).toBe('EDITED');
    expect(body.data.draft.draftText).toBe('Edited version of the text');
  });

  it('returns APPROVED draft with full draftText', async () => {
    const d = mockDeps();
    d.replyDraftRepository.getCurrentByConversation.mockResolvedValue(ok({
      draft: {
        id: DRAFT_ID,
        conversationId: CONV_ID,
        status: 'APPROVED',
        source: 'SYSTEM',
        draftText: DRAFT_TEXT,
        draftTextPreview: DRAFT_TEXT,
        originalText: ORIGINAL_TEXT,
        reviewedAt: NOW.toISOString(),
        reviewedByUserId: USER_ID,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    }));
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.draft.status).toBe('APPROVED');
    expect(body.data.draft.draftText).toBe(DRAFT_TEXT);
    expect(body.data.draft.reviewedAt).toBe(NOW.toISOString());
    expect(body.data.draft.reviewedByUserId).toBe(USER_ID);
  });

  it('returns originalText in response', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    const body = await r.json();
    expect(body.data.draft.originalText).toBe(ORIGINAL_TEXT);
  });

  it('returns draftTextPreview in response', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    const body = await r.json();
    expect(body.data.draft).toHaveProperty('draftTextPreview');
  });

  it('passes correct input to getCurrentByConversation', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    await h(getRequest(), P);
    expect(d.replyDraftRepository.getCurrentByConversation).toHaveBeenCalledWith({
      businessId: BIZ_ID,
      conversationId: CONV_ID,
    });
  });

  it('returns error when repository read fails', async () => {
    const d = mockDeps();
    d.replyDraftRepository.getCurrentByConversation.mockResolvedValue(err('REPLY_DRAFT_REPOSITORY_ERROR', 'Repository error'));
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('does not expose model metadata (modelProvider/modelName/promptVersion)', async () => {
    const d = mockDeps();
    const h = createCurrentDraftHandler({ ...d, resolveTenantContext: okTenant() });
    const r = await h(getRequest(), P);
    const body = await r.json();
    expect(body.data.draft).not.toHaveProperty('modelProvider');
    expect(body.data.draft).not.toHaveProperty('modelName');
    expect(body.data.draft).not.toHaveProperty('promptVersion');
  });

  // -------------------------------------------------------------------------
  // Scope guards
  // -------------------------------------------------------------------------

  it('handler does not import Prisma directly', () => {
    const src = fs.readFileSync(
      path.resolve('src/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/handler.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/from ['"]@prisma\/client['"]/);
    expect(src).not.toMatch(/PrismaClient/);
  });

  it('route does not import Prisma directly', () => {
    const src = fs.readFileSync(
      path.resolve('src/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/route.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/from ['"]@prisma\/client['"]/);
    expect(src).not.toMatch(/PrismaClient/);
  });

  it('no LLM/provider imports in handler', () => {
    const src = fs.readFileSync(
      path.resolve('src/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/handler.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/^import.*(?:openai|anthropic|gemini)/im);
    expect(src).not.toMatch(/require\(['"](?:openai|anthropic|@google-ai)/);
  });

  it('no outbound message creation in handler', () => {
    const src = fs.readFileSync(
      path.resolve('src/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/handler.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/createMessage|message\.create|OUTBOUND|senderType/i);
  });

  it('no mutation methods called in handler', () => {
    const src = fs.readFileSync(
      path.resolve('src/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/handler.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/updateConversation|editDraft|discardDraft|approveDraft|generateOrReuseStubDraft|createSystemDraft/);
  });

  it('handler uses ai_drafts.read not ai_drafts.generate or ai_drafts.approve', () => {
    const src = fs.readFileSync(
      path.resolve('src/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/handler.ts'),
      'utf8',
    );
    expect(src).toMatch(/ai_drafts\.read/);
    expect(src).not.toMatch(/ai_drafts\.generate/);
    expect(src).not.toMatch(/ai_drafts\.approve/);
  });

  it('handler follows DI pattern', () => {
    const src = fs.readFileSync(
      path.resolve('src/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/handler.ts'),
      'utf8',
    );
    expect(src).toMatch(/createCurrentDraftHandler/);
    expect(src).toMatch(/CurrentDraftHandlerDeps/);
  });
});

// ===========================================================================
// Route integration tests
// ===========================================================================

describe('Current Draft Route', () => {
  it('returns 501 when feature flag is not set', async () => {
    delete process.env[API_HANDLERS_FEATURE_FLAG];
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/route'
    );
    const r = await GET(
      new Request('http://x', {
        method: 'GET',
        headers: {
          [DEV_AUTH_HEADERS.userId]: USER_ID,
          [DEV_AUTH_HEADERS.businessId]: BIZ_ID,
          [DEV_AUTH_HEADERS.membershipId]: MEM_ID,
          [DEV_AUTH_HEADERS.role]: 'OWNER',
        },
      }),
      { params: Promise.resolve({ businessId: BIZ_ID, conversationId: CONV_ID }) },
    );
    expect(r.status).toBe(501);
  });

  it('returns non-501 when feature flag is enabled', async () => {
    process.env[API_HANDLERS_FEATURE_FLAG] = 'true';
    process.env[DEV_AUTH_CONTEXT_FEATURE_FLAG] = 'true';
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/conversations/[conversationId]/reply-drafts/current/route'
    );
    const r = await GET(
      new Request('http://x', {
        method: 'GET',
        headers: {
          [DEV_AUTH_HEADERS.userId]: USER_ID,
          [DEV_AUTH_HEADERS.businessId]: BIZ_ID,
          [DEV_AUTH_HEADERS.membershipId]: MEM_ID,
          [DEV_AUTH_HEADERS.role]: 'OWNER',
        },
      }),
      { params: Promise.resolve({ businessId: BIZ_ID, conversationId: CONV_ID }) },
    );
    expect(r.status).not.toBe(501);
  });
});

// ===========================================================================
// Repository unit tests — getCurrentByConversation
// ===========================================================================

describe('ReplyDraft Repository — getCurrentByConversation', () => {
  function mockDb(): ReplyDraftRepositoryDb & {
    replyDraft: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  } {
    return {
      replyDraft: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: DRAFT_ID,
          businessId: BIZ_ID,
          conversationId: CONV_ID,
          source: 'SYSTEM',
          status: 'PENDING_REVIEW',
          draftText: DRAFT_TEXT,
          originalText: ORIGINAL_TEXT,
          reviewedByUserId: null,
          reviewedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        }),
        update: vi.fn().mockImplementation(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
          id: args.where.id,
          businessId: BIZ_ID,
          conversationId: CONV_ID,
          source: 'SYSTEM',
          status: args.data.status ?? 'PENDING_REVIEW',
          draftText: (args.data as Record<string, unknown>).draftText ?? DRAFT_TEXT,
          originalText: ORIGINAL_TEXT,
          reviewedByUserId: args.data.reviewedByUserId ?? null,
          reviewedAt: args.data.reviewedAt ?? null,
          createdAt: NOW,
          updatedAt: NOW,
        })),
      },
    };
  }

  const pendingDraft: ReplyDraftRecord = {
    id: DRAFT_ID,
    businessId: BIZ_ID,
    conversationId: CONV_ID,
    source: 'SYSTEM',
    status: 'PENDING_REVIEW',
    draftText: DRAFT_TEXT,
    originalText: ORIGINAL_TEXT,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const editedDraft: ReplyDraftRecord = { ...pendingDraft, status: 'EDITED', draftText: 'Edited version' };
  const approvedDraft: ReplyDraftRecord = { ...pendingDraft, status: 'APPROVED', reviewedByUserId: USER_ID, reviewedAt: NOW };
  const discardedDraft: ReplyDraftRecord = { ...pendingDraft, status: 'DISCARDED', reviewedByUserId: USER_ID, reviewedAt: NOW };
  const sentDraft: ReplyDraftRecord = { ...pendingDraft, status: 'SENT', reviewedByUserId: USER_ID, reviewedAt: NOW };

  it('returns null when no active draft exists', async () => {
    const db = mockDb();
    db.replyDraft.findMany.mockResolvedValue([]);
    const repo = createReplyDraftRepository(db);
    const result = await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.draft).toBeNull();
    }
  });

  it('returns PENDING_REVIEW draft with full draftText', async () => {
    const db = mockDb();
    db.replyDraft.findMany.mockResolvedValue([pendingDraft]);
    const repo = createReplyDraftRepository(db);
    const result = await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.draft).not.toBeNull();
      expect(result.data.draft!.status).toBe('PENDING_REVIEW');
      expect(result.data.draft!.draftText).toBe(DRAFT_TEXT);
      expect(result.data.draft!.originalText).toBe(ORIGINAL_TEXT);
      expect(result.data.draft!.source).toBe('SYSTEM');
    }
  });

  it('returns EDITED draft with full draftText', async () => {
    const db = mockDb();
    db.replyDraft.findMany.mockResolvedValue([editedDraft]);
    const repo = createReplyDraftRepository(db);
    const result = await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.draft!.status).toBe('EDITED');
      expect(result.data.draft!.draftText).toBe('Edited version');
    }
  });

  it('returns APPROVED draft with full draftText', async () => {
    const db = mockDb();
    db.replyDraft.findMany.mockResolvedValue([approvedDraft]);
    const repo = createReplyDraftRepository(db);
    const result = await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.draft!.status).toBe('APPROVED');
      expect(result.data.draft!.draftText).toBe(DRAFT_TEXT);
      expect(result.data.draft!.reviewedAt).toBeTruthy();
      expect(result.data.draft!.reviewedByUserId).toBe(USER_ID);
    }
  });

  it('queries with ACTIVE_DRAFT_STATUSES (includes PENDING_REVIEW, EDITED, APPROVED)', async () => {
    const db = mockDb();
    const repo = createReplyDraftRepository(db);
    await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    const call = db.replyDraft.findMany.mock.calls[0]?.[0];
    expect(call?.where?.status?.in).toEqual(
      expect.arrayContaining(['PENDING_REVIEW', 'EDITED', 'APPROVED']),
    );
    expect(call?.where?.status?.in).not.toContain('DISCARDED');
    expect(call?.where?.status?.in).not.toContain('SENT');
  });

  it('scopes query by businessId and conversationId', async () => {
    const db = mockDb();
    const repo = createReplyDraftRepository(db);
    await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    const call = db.replyDraft.findMany.mock.calls[0]?.[0];
    expect(call?.where?.businessId).toBe(BIZ_ID);
    expect(call?.where?.conversationId).toBe(CONV_ID);
  });

  it('selects latest active by createdAt desc', async () => {
    const db = mockDb();
    const repo = createReplyDraftRepository(db);
    await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    const call = db.replyDraft.findMany.mock.calls[0]?.[0];
    expect(call?.orderBy).toEqual({ createdAt: 'desc' });
    expect(call?.take).toBe(1);
  });

  it('returns draftTextPreview (truncated)', async () => {
    const db = mockDb();
    const longDraft: ReplyDraftRecord = { ...pendingDraft, draftText: 'A'.repeat(200) };
    db.replyDraft.findMany.mockResolvedValue([longDraft]);
    const repo = createReplyDraftRepository(db);
    const result = await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.draft!.draftTextPreview.length).toBeLessThan(200);
      expect(result.data.draft!.draftText.length).toBe(200);
    }
  });

  it('omits model metadata from DTO', async () => {
    const db = mockDb();
    db.replyDraft.findMany.mockResolvedValue([pendingDraft]);
    const repo = createReplyDraftRepository(db);
    const result = await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const draft = result.data.draft!;
      expect(draft).not.toHaveProperty('modelProvider');
      expect(draft).not.toHaveProperty('modelName');
      expect(draft).not.toHaveProperty('promptVersion');
    }
  });

  it('returns error on DB failure', async () => {
    const db = mockDb();
    db.replyDraft.findMany.mockRejectedValue(new Error('DB error'));
    const repo = createReplyDraftRepository(db);
    const result = await repo.getCurrentByConversation({ businessId: BIZ_ID, conversationId: CONV_ID });
    expect(result.ok).toBe(false);
  });
});
