// ===========================================================================
// Tests — Conversation Route Skeletons (501 when feature gate disabled)
// ===========================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { API_HANDLERS_FEATURE_FLAG } from '@/app/api/_shared/feature-gate';

// ---------------------------------------------------------------------------
// Setup: disable feature gate
// ---------------------------------------------------------------------------

beforeEach(() => {
  delete process.env[API_HANDLERS_FEATURE_FLAG];
});

afterEach(() => {
  delete process.env[API_HANDLERS_FEATURE_FLAG];
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BID = '44444444-4444-4444-8444-444444444444';
const CONV_ID = '55555555-5555-4555-8555-555555555555';

function makeContext<T>(params: T) {
  return { params: Promise.resolve(params) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Conversation Route Skeletons — 501 when feature gate disabled', () => {
  it('GET /conversations returns 501', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/conversations/route'
    );
    const res = await GET(
      new Request(`http://localhost/api/businesses/${BID}/conversations`),
      makeContext({ businessId: BID }),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /conversations returns 501', async () => {
    const { POST } = await import(
      '@/app/api/businesses/[businessId]/conversations/route'
    );
    const res = await POST(
      new Request(`http://localhost/api/businesses/${BID}/conversations`, { method: 'POST' }),
      makeContext({ businessId: BID }),
    );
    expect(res.status).toBe(501);
  });

  it('GET /conversations/:conversationId returns 501', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/conversations/[conversationId]/route'
    );
    const res = await GET(
      new Request(`http://localhost/api/businesses/${BID}/conversations/${CONV_ID}`),
      makeContext({ businessId: BID, conversationId: CONV_ID }),
    );
    expect(res.status).toBe(501);
  });

  it('PATCH /conversations/:conversationId returns 501', async () => {
    const { PATCH } = await import(
      '@/app/api/businesses/[businessId]/conversations/[conversationId]/route'
    );
    const res = await PATCH(
      new Request(`http://localhost/api/businesses/${BID}/conversations/${CONV_ID}`, { method: 'PATCH' }),
      makeContext({ businessId: BID, conversationId: CONV_ID }),
    );
    expect(res.status).toBe(501);
  });

  it('POST /conversations/:conversationId/status returns 501', async () => {
    const { POST } = await import(
      '@/app/api/businesses/[businessId]/conversations/[conversationId]/status/route'
    );
    const res = await POST(
      new Request(`http://localhost/api/businesses/${BID}/conversations/${CONV_ID}/status`, { method: 'POST' }),
      makeContext({ businessId: BID, conversationId: CONV_ID }),
    );
    expect(res.status).toBe(501);
  });

  it('GET /conversations/:conversationId/messages returns 501', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/conversations/[conversationId]/messages/route'
    );
    const res = await GET(
      new Request(`http://localhost/api/businesses/${BID}/conversations/${CONV_ID}/messages`),
      makeContext({ businessId: BID, conversationId: CONV_ID }),
    );
    expect(res.status).toBe(501);
  });

  it('POST /conversations/:conversationId/messages returns 501', async () => {
    const { POST } = await import(
      '@/app/api/businesses/[businessId]/conversations/[conversationId]/messages/route'
    );
    const res = await POST(
      new Request(`http://localhost/api/businesses/${BID}/conversations/${CONV_ID}/messages`, { method: 'POST' }),
      makeContext({ businessId: BID, conversationId: CONV_ID }),
    );
    expect(res.status).toBe(501);
  });
});
