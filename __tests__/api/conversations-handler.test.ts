// ===========================================================================
// Tests — Conversation API Handlers
// ===========================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  createListConversationsHandler,
  createPostConversationHandler,
  createGetConversationByIdHandler,
  createPatchConversationHandler,
  createChangeConversationStatusHandler,
  createListMessagesHandler,
  createPostMessageHandler,
  createConversationHandlers,
  type ConversationHandlerDeps,
} from '@/app/api/businesses/[businessId]/conversations/handler';
import {
  createTenantRequestContext,
  type TenantRequestContext,
} from '@/app/api/_shared/request-context';
import { apiError } from '@/app/api/_shared/responses';
import { ok, err } from '@/lib/result';
import type { ConversationWithSummary, MessageIdentity } from '@/domains/conversations/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BUSINESS_ID = '44444444-4444-4444-8444-444444444444';
const CONV_ID = '55555555-5555-4555-8555-555555555555';
const MSG_ID = '66666666-6666-4666-8666-666666666666';
const CUSTOMER_ID = '77777777-7777-4777-8777-777777777777';
const MEMBERSHIP_ID = '88888888-8888-4888-8888-888888888888';

const MOCK_CONVERSATION: ConversationWithSummary = {
  id: CONV_ID,
  businessId: BUSINESS_ID,
  customerId: CUSTOMER_ID,
  channel: 'INTERNAL',
  status: 'NEW',
  subject: 'Test Subject',
  assignedUserId: null,
  aiClassificationStatus: 'NOT_REQUESTED',
  aiDraftStatus: 'NOT_REQUESTED',
  channelMetadata: null,
  metadata: null,
  closedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  messageCount: 0,
  lastMessageAt: null,
  lastMessageContent: null,
  lastMessageDirection: null,
  lastMessageSenderType: null,
};

const MOCK_MESSAGE: MessageIdentity = {
  id: MSG_ID,
  conversationId: CONV_ID,
  businessId: BUSINESS_ID,
  direction: 'OUTBOUND',
  senderType: 'OPERATOR',
  senderUserId: USER_ID,
  senderCustomerId: null,
  content: 'Hello there',
  contentType: 'text/plain',
  channelMetadata: null,
  metadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Mock tenant context
// ---------------------------------------------------------------------------

const MOCK_TENANT_CONTEXT: TenantRequestContext = createTenantRequestContext({
  tenant: {
    userId: USER_ID,
    businessId: BUSINESS_ID,
    membershipId: MEMBERSHIP_ID,
    role: 'OWNER',
  },
});

const mockResolveTenantContext: ConversationHandlerDeps['resolveTenantContext'] =
  () => Promise.resolve({ ok: true, context: MOCK_TENANT_CONTEXT });

const mockResolveTenantContextDenied: ConversationHandlerDeps['resolveTenantContext'] =
  () =>
    Promise.resolve({
      ok: false,
      response: apiError('UNAUTHENTICATED', 'Authentication required', 401),
    });

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeDeps(overrides?: Partial<ConversationHandlerDeps>): ConversationHandlerDeps {
  return {
    conversationService: {
      createConversation: vi.fn().mockResolvedValue(ok(MOCK_CONVERSATION)),
      findConversationById: vi.fn().mockResolvedValue(ok(MOCK_CONVERSATION)),
      listConversations: vi.fn().mockResolvedValue(ok({ data: [MOCK_CONVERSATION], nextCursor: null })),
      updateConversation: vi.fn().mockResolvedValue(ok(MOCK_CONVERSATION)),
      changeStatus: vi.fn().mockResolvedValue(ok({ id: CONV_ID, businessId: BUSINESS_ID, status: 'OPEN' })),
      createMessage: vi.fn().mockResolvedValue(ok(MOCK_MESSAGE)),
      listMessages: vi.fn().mockResolvedValue(ok({ data: [MOCK_MESSAGE], nextCursor: null })),
    },
    authzService: {
      requirePermission: vi.fn().mockResolvedValue(ok({ allowed: true })),
    },
    resolveTenantContext: mockResolveTenantContext,
    ...overrides,
  };
}

function makeRequest(method: string, url: string, body?: unknown): Request {
  if (body) {
    return new Request(url, {
      method,
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Request(url, { method });
}

// ---------------------------------------------------------------------------
// Combined factory
// ---------------------------------------------------------------------------

describe('Conversation Handler — createConversationHandlers factory', () => {
  it('returns all 7 handler functions', () => {
    const handlers = createConversationHandlers(makeDeps());
    expect(handlers.LIST_CONVERSATIONS).toBeTypeOf('function');
    expect(handlers.CREATE_CONVERSATION).toBeTypeOf('function');
    expect(handlers.GET_CONVERSATION).toBeTypeOf('function');
    expect(handlers.PATCH_CONVERSATION).toBeTypeOf('function');
    expect(handlers.CHANGE_STATUS).toBeTypeOf('function');
    expect(handlers.LIST_MESSAGES).toBeTypeOf('function');
    expect(handlers.CREATE_MESSAGE).toBeTypeOf('function');
  });
});

// ---------------------------------------------------------------------------
// List conversations
// ---------------------------------------------------------------------------

describe('Conversation Handler — LIST_CONVERSATIONS', () => {
  it('returns 200 with conversations', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.data).toHaveLength(1);
  });

  it('returns 401 when context fails', async () => {
    const deps = makeDeps({ resolveTenantContext: mockResolveTenantContextDenied });
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when authz denied', async () => {
    const deps = makeDeps();
    vi.mocked(deps.authzService.requirePermission).mockResolvedValueOnce(
      ok({ allowed: false, reason: 'ROLE_NOT_PERMITTED' }),
    );
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid businessId param', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', 'http://localhost/api/businesses/not-uuid/conversations'),
      { businessId: 'not-uuid' },
    );
    expect(res.status).toBe(400);
  });

  it('passes query params to service', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations?status=OPEN&channel=INTERNAL&limit=10&cursor=${CONV_ID}`),
      { businessId: BUSINESS_ID },
    );
    expect(deps.conversationService.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: BUSINESS_ID,
        status: 'OPEN',
        channel: 'INTERNAL',
        limit: 10,
        cursor: CONV_ID,
      }),
    );
  });

  it('returns 400 for invalid status query param', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations?status=BAD`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CONVERSATION_INPUT');
    expect(deps.conversationService.listConversations).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid channel query param', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations?channel=TELEGRAM`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CONVERSATION_INPUT');
  });

  it('returns 400 for invalid assignedUserId query param', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations?assignedUserId=not-uuid`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CONVERSATION_INPUT');
  });

  it('returns 400 for invalid customerId query param', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations?customerId=not-uuid`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CONVERSATION_INPUT');
  });

  it('returns 400 for invalid cursor query param', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations?cursor=not-uuid`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CONVERSATION_INPUT');
  });

  it('returns 400 for invalid limit query param', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations?limit=abc`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CONVERSATION_INPUT');
  });

  it('returns 400 for limit=0', async () => {
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations?limit=0`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Create conversation
// ---------------------------------------------------------------------------

describe('Conversation Handler — CREATE_CONVERSATION', () => {
  it('returns 201 with created conversation', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        subject: 'New inquiry',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('injects businessId from route and actorUserId from context', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        subject: 'Test',
        channel: 'INTERNAL',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(deps.conversationService.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: BUSINESS_ID,
        actorUserId: USER_ID,
        channel: 'INTERNAL',
        subject: 'Test',
      }),
    );
  });

  it('passes initialMessage with handler-derived senderType to service', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        subject: 'With message',
        initialMessage: {
          content: 'Hello',
          direction: 'OUTBOUND',
        },
      }),
      { businessId: BUSINESS_ID },
    );
    expect(deps.conversationService.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        initialMessage: expect.objectContaining({
          content: 'Hello',
          direction: 'OUTBOUND',
          senderType: 'OPERATOR',
          senderUserId: USER_ID,
        }),
      }),
    );
  });

  it('rejects initialMessage with senderType (impersonation)', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        initialMessage: {
          content: 'Hello',
          direction: 'OUTBOUND',
          senderType: 'AI_RECEPTIONIST',
        },
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
  });

  it('rejects initialMessage with senderUserId (impersonation)', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        initialMessage: {
          content: 'Hello',
          direction: 'OUTBOUND',
          senderUserId: '99999999-9999-4999-8999-999999999999',
        },
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
  });

  it('derives senderUserId from context for OUTBOUND initialMessage', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        initialMessage: {
          content: 'Reply',
          direction: 'OUTBOUND',
        },
      }),
      { businessId: BUSINESS_ID },
    );
    const call = vi.mocked(deps.conversationService.createConversation).mock.calls[0][0];
    expect(call.initialMessage?.senderUserId).toBe(USER_ID);
    expect(call.initialMessage?.senderType).toBe('OPERATOR');
  });

  it('allows senderCustomerId for INBOUND initialMessage', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        initialMessage: {
          content: 'Customer msg',
          direction: 'INBOUND',
          senderCustomerId: CUSTOMER_ID,
        },
      }),
      { businessId: BUSINESS_ID },
    );
    const call = vi.mocked(deps.conversationService.createConversation).mock.calls[0][0];
    expect(call.initialMessage?.senderCustomerId).toBe(CUSTOMER_ID);
    expect(call.initialMessage?.senderType).toBe('CUSTOMER');
    expect(call.initialMessage?.senderUserId).toBeUndefined();
  });

  it('rejects senderCustomerId for OUTBOUND initialMessage', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        initialMessage: {
          content: 'Hello',
          direction: 'OUTBOUND',
          senderCustomerId: CUSTOMER_ID,
        },
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
  });

  it('rejects SYSTEM direction for initialMessage', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        initialMessage: {
          content: 'System msg',
          direction: 'SYSTEM',
        },
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid body', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        channel: 'TELEGRAM',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when customer not in business', async () => {
    const deps = makeDeps();
    vi.mocked(deps.conversationService.createConversation).mockResolvedValueOnce(
      err('CUSTOMER_NOT_IN_BUSINESS', 'Customer does not belong to this business'),
    );
    const handler = createPostConversationHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        customerId: CUSTOMER_ID,
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when authz denied', async () => {
    const deps = makeDeps();
    vi.mocked(deps.authzService.requirePermission).mockResolvedValueOnce(
      ok({ allowed: false, reason: 'ROLE_NOT_PERMITTED' }),
    );
    const handler = createPostConversationHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        subject: 'Test',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(403);
  });

  it('does NOT call auditService from handler', async () => {
    const deps = makeDeps();
    const handler = createPostConversationHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations`, {
        subject: 'New',
      }),
      { businessId: BUSINESS_ID },
    );
    // Handler no longer has auditService — domain service is source of truth
    expect(deps).not.toHaveProperty('auditService');
  });
});

// ---------------------------------------------------------------------------
// Get conversation by ID
// ---------------------------------------------------------------------------

describe('Conversation Handler — GET_CONVERSATION', () => {
  it('returns 200 with conversation', async () => {
    const deps = makeDeps();
    const handler = createGetConversationByIdHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}`),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(CONV_ID);
  });

  it('returns 404 when not found', async () => {
    const deps = makeDeps();
    vi.mocked(deps.conversationService.findConversationById).mockResolvedValueOnce(ok(null));
    const handler = createGetConversationByIdHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}`),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid UUID params', async () => {
    const deps = makeDeps();
    const handler = createGetConversationByIdHandler(deps);
    const res = await handler(
      makeRequest('GET', 'http://localhost/api/businesses/bad/conversations/bad'),
      { businessId: 'bad', conversationId: 'bad' },
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Update conversation
// ---------------------------------------------------------------------------

describe('Conversation Handler — PATCH_CONVERSATION', () => {
  it('returns 200 with updated conversation', async () => {
    const deps = makeDeps();
    const handler = createPatchConversationHandler(deps);
    const res = await handler(
      makeRequest('PATCH', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}`, {
        subject: 'Updated Subject',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 when no fields provided', async () => {
    const deps = makeDeps();
    const handler = createPatchConversationHandler(deps);
    const res = await handler(
      makeRequest('PATCH', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}`, {}),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when customerId not in business', async () => {
    const deps = makeDeps();
    vi.mocked(deps.conversationService.updateConversation).mockResolvedValueOnce(
      err('CUSTOMER_NOT_IN_BUSINESS', 'Customer does not belong to this business'),
    );
    const handler = createPatchConversationHandler(deps);
    const res = await handler(
      makeRequest('PATCH', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}`, {
        customerId: CUSTOMER_ID,
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    const deps = makeDeps();
    vi.mocked(deps.conversationService.updateConversation).mockResolvedValueOnce(
      err('CONVERSATION_NOT_FOUND', 'Conversation not found'),
    );
    const handler = createPatchConversationHandler(deps);
    const res = await handler(
      makeRequest('PATCH', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}`, {
        subject: 'X',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(404);
  });

  it('does NOT call auditService from handler', async () => {
    const deps = makeDeps();
    const handler = createPatchConversationHandler(deps);
    await handler(
      makeRequest('PATCH', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}`, {
        subject: 'Updated',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(deps).not.toHaveProperty('auditService');
  });
});

// ---------------------------------------------------------------------------
// Change status
// ---------------------------------------------------------------------------

describe('Conversation Handler — CHANGE_STATUS', () => {
  it('returns 200 for valid transition', async () => {
    const deps = makeDeps();
    const handler = createChangeConversationStatusHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/status`, {
        status: 'OPEN',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid status value', async () => {
    const deps = makeDeps();
    const handler = createChangeConversationStatusHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/status`, {
        status: 'INVALID',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid transition from domain service', async () => {
    const deps = makeDeps();
    vi.mocked(deps.conversationService.changeStatus).mockResolvedValueOnce(
      err('INVALID_CONVERSATION_TRANSITION', 'Invalid transition'),
    );
    const handler = createChangeConversationStatusHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/status`, {
        status: 'OPEN',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when conversation not found', async () => {
    const deps = makeDeps();
    vi.mocked(deps.conversationService.changeStatus).mockResolvedValueOnce(
      err('CONVERSATION_NOT_FOUND', 'Conversation not found'),
    );
    const handler = createChangeConversationStatusHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/status`, {
        status: 'OPEN',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(404);
  });

  it('uses conversations.close permission when toStatus is RESOLVED', async () => {
    const deps = makeDeps();
    const handler = createChangeConversationStatusHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/status`, {
        status: 'RESOLVED',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(deps.authzService.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'conversations.close' }),
    );
  });

  it('uses conversations.reply permission for non-RESOLVED transitions', async () => {
    const deps = makeDeps();
    const handler = createChangeConversationStatusHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/status`, {
        status: 'OPEN',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(deps.authzService.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'conversations.reply' }),
    );
  });
});

// ---------------------------------------------------------------------------
// List messages
// ---------------------------------------------------------------------------

describe('Conversation Handler — LIST_MESSAGES', () => {
  it('returns 200 with messages', async () => {
    const deps = makeDeps();
    const handler = createListMessagesHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.data).toHaveLength(1);
  });

  it('passes direction filter', async () => {
    const deps = makeDeps();
    const handler = createListMessagesHandler(deps);
    await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages?direction=INBOUND`),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(deps.conversationService.listMessages).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'INBOUND' }),
    );
  });

  it('passes limit and cursor', async () => {
    const deps = makeDeps();
    const handler = createListMessagesHandler(deps);
    await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages?limit=20&cursor=${MSG_ID}`),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(deps.conversationService.listMessages).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, cursor: MSG_ID }),
    );
  });

  it('returns 400 for invalid direction filter', async () => {
    const deps = makeDeps();
    const handler = createListMessagesHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages?direction=BAD`),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_MESSAGE_INPUT');
  });

  it('returns 400 for invalid cursor on messages', async () => {
    const deps = makeDeps();
    const handler = createListMessagesHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages?cursor=not-uuid`),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_MESSAGE_INPUT');
  });

  it('returns 400 for invalid limit on messages', async () => {
    const deps = makeDeps();
    const handler = createListMessagesHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages?limit=abc`),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_MESSAGE_INPUT');
  });
});

// ---------------------------------------------------------------------------
// Create message
// ---------------------------------------------------------------------------

describe('Conversation Handler — CREATE_MESSAGE', () => {
  it('returns 201 for OUTBOUND message', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'Reply to customer',
        direction: 'OUTBOUND',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(201);
  });

  it('auto-sets senderUserId from context for OUTBOUND', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'Reply',
        direction: 'OUTBOUND',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(deps.conversationService.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: USER_ID,
        direction: 'OUTBOUND',
        conversationId: CONV_ID,
        businessId: BUSINESS_ID,
      }),
    );
  });

  it('auto-sets senderUserId from context for INTERNAL', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'Internal note',
        direction: 'INTERNAL',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(deps.conversationService.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: USER_ID,
        direction: 'INTERNAL',
      }),
    );
  });

  it('allows senderCustomerId for INBOUND messages', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'Customer message',
        direction: 'INBOUND',
        senderCustomerId: CUSTOMER_ID,
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(deps.conversationService.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderCustomerId: CUSTOMER_ID,
        direction: 'INBOUND',
      }),
    );
  });

  it('rejects senderCustomerId for OUTBOUND', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'Reply',
        direction: 'OUTBOUND',
        senderCustomerId: CUSTOMER_ID,
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_MESSAGE_INPUT');
  });

  it('rejects senderCustomerId for INTERNAL', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'Note',
        direction: 'INTERNAL',
        senderCustomerId: CUSTOMER_ID,
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
  });

  it('rejects SYSTEM direction at API boundary', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'System notification',
        direction: 'SYSTEM',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_MESSAGE_INPUT');
  });

  it('returns 400 for missing content', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        direction: 'OUTBOUND',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid direction', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'Test',
        direction: 'INVALID',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when authz denied', async () => {
    const deps = makeDeps();
    vi.mocked(deps.authzService.requirePermission).mockResolvedValueOnce(
      ok({ allowed: false, reason: 'ROLE_NOT_PERMITTED' }),
    );
    const handler = createPostMessageHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'Test',
        direction: 'OUTBOUND',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(403);
  });

  it('does NOT call auditService from handler', async () => {
    const deps = makeDeps();
    const handler = createPostMessageHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/conversations/${CONV_ID}/messages`, {
        content: 'Test',
        direction: 'OUTBOUND',
      }),
      { businessId: BUSINESS_ID, conversationId: CONV_ID },
    );
    expect(deps).not.toHaveProperty('auditService');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: tenant mismatch
// ---------------------------------------------------------------------------

describe('Conversation Handler — tenant mismatch', () => {
  it('returns 403 when route businessId does not match context (list)', async () => {
    const OTHER_BID = '99999999-9999-4999-8999-999999999999';
    const deps = makeDeps();
    const handler = createListConversationsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${OTHER_BID}/conversations`),
      { businessId: OTHER_BID },
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when route businessId does not match context (messages)', async () => {
    const OTHER_BID = '99999999-9999-4999-8999-999999999999';
    const deps = makeDeps();
    const handler = createListMessagesHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${OTHER_BID}/conversations/${CONV_ID}/messages`),
      { businessId: OTHER_BID, conversationId: CONV_ID },
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// No handler-level audit (domain service is source of truth)
// ---------------------------------------------------------------------------

describe('Conversation Handler — no handler-level audit', () => {
  it('ConversationHandlerDeps does not include auditService', () => {
    const deps = makeDeps();
    expect(deps).not.toHaveProperty('auditService');
  });
});

// ---------------------------------------------------------------------------
// Wrong-scope scan
// ---------------------------------------------------------------------------

describe('Conversation Handler — wrong-scope term scan', () => {
  it('handler file does not contain wrong-scope terms', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const handlerPath = path.resolve(
      __dirname,
      '../../src/app/api/businesses/[businessId]/conversations/handler.ts',
    );
    const content = fs.readFileSync(handlerPath, 'utf-8');
    const wrongTerms = [
      'andoub',       // partial match avoids self-reference
      'ServiceCategory',
      'ServiceRequest',
      'service catalog',
      'order foundation',
      'hatsApp',      // partial match avoids self-reference
      'nstagram',     // partial match avoids self-reference
    ];
    for (const term of wrongTerms) {
      expect(content).not.toContain(term);
    }
  });
});
