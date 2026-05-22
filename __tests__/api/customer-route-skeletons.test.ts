// ===========================================================================
// Tests — Customer Route Skeletons (501 when feature gate disabled)
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
const CID = '77777777-7777-4777-8777-777777777777';
const CMID = '88888888-8888-4888-8888-888888888888';

function makeContext<T>(params: T) {
  return { params: Promise.resolve(params) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Customer Route Skeletons — 501 when feature gate disabled', () => {
  it('GET /customers returns 501', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/customers/route'
    );
    const res = await GET(
      new Request(`http://localhost/api/businesses/${BID}/customers`),
      makeContext({ businessId: BID }),
    );
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST /customers returns 501', async () => {
    const { POST } = await import(
      '@/app/api/businesses/[businessId]/customers/route'
    );
    const res = await POST(
      new Request(`http://localhost/api/businesses/${BID}/customers`, { method: 'POST' }),
      makeContext({ businessId: BID }),
    );
    expect(res.status).toBe(501);
  });

  it('GET /customers/:customerId returns 501', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/customers/[customerId]/route'
    );
    const res = await GET(
      new Request(`http://localhost/api/businesses/${BID}/customers/${CID}`),
      makeContext({ businessId: BID, customerId: CID }),
    );
    expect(res.status).toBe(501);
  });

  it('PATCH /customers/:customerId returns 501', async () => {
    const { PATCH } = await import(
      '@/app/api/businesses/[businessId]/customers/[customerId]/route'
    );
    const res = await PATCH(
      new Request(`http://localhost/api/businesses/${BID}/customers/${CID}`, { method: 'PATCH' }),
      makeContext({ businessId: BID, customerId: CID }),
    );
    expect(res.status).toBe(501);
  });

  it('POST /customers/:customerId/archive returns 501', async () => {
    const { POST } = await import(
      '@/app/api/businesses/[businessId]/customers/[customerId]/archive/route'
    );
    const res = await POST(
      new Request(`http://localhost/api/businesses/${BID}/customers/${CID}/archive`, { method: 'POST' }),
      makeContext({ businessId: BID, customerId: CID }),
    );
    expect(res.status).toBe(501);
  });

  it('GET /customers/:customerId/contact-methods returns 501', async () => {
    const { GET } = await import(
      '@/app/api/businesses/[businessId]/customers/[customerId]/contact-methods/route'
    );
    const res = await GET(
      new Request(`http://localhost/api/businesses/${BID}/customers/${CID}/contact-methods`),
      makeContext({ businessId: BID, customerId: CID }),
    );
    expect(res.status).toBe(501);
  });

  it('POST /customers/:customerId/contact-methods returns 501', async () => {
    const { POST } = await import(
      '@/app/api/businesses/[businessId]/customers/[customerId]/contact-methods/route'
    );
    const res = await POST(
      new Request(`http://localhost/api/businesses/${BID}/customers/${CID}/contact-methods`, { method: 'POST' }),
      makeContext({ businessId: BID, customerId: CID }),
    );
    expect(res.status).toBe(501);
  });

  it('DELETE /customers/:customerId/contact-methods/:contactMethodId returns 501', async () => {
    const { DELETE } = await import(
      '@/app/api/businesses/[businessId]/customers/[customerId]/contact-methods/[contactMethodId]/route'
    );
    const res = await DELETE(
      new Request(`http://localhost/api/businesses/${BID}/customers/${CID}/contact-methods/${CMID}`, { method: 'DELETE' }),
      makeContext({ businessId: BID, customerId: CID, contactMethodId: CMID }),
    );
    expect(res.status).toBe(501);
  });

  it('POST /customers/resolve returns 501', async () => {
    const { POST } = await import(
      '@/app/api/businesses/[businessId]/customers/resolve/route'
    );
    const res = await POST(
      new Request(`http://localhost/api/businesses/${BID}/customers/resolve`, { method: 'POST' }),
      makeContext({ businessId: BID }),
    );
    expect(res.status).toBe(501);
  });
});
