// ===========================================================================
// Tests — Customer API Handlers
// ===========================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  createListCustomersHandler,
  createPostCustomerHandler,
  createGetCustomerByIdHandler,
  createPatchCustomerHandler,
  createArchiveCustomerHandler,
  createListContactMethodsHandler,
  createAddContactMethodHandler,
  createRemoveContactMethodHandler,
  createResolveCustomerHandler,
  createCustomerHandlers,
  type CustomerHandlerDeps,
} from '@/app/api/businesses/[businessId]/customers/handler';
import {
  createTenantRequestContext,
  type TenantRequestContext,
} from '@/app/api/_shared/request-context';
import { apiError } from '@/app/api/_shared/responses';
import { ok, err } from '@/lib/result';
import type { CustomerWithContacts, ContactMethodIdentity } from '@/domains/crm/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BUSINESS_ID = '44444444-4444-4444-8444-444444444444';
const CUSTOMER_ID = '77777777-7777-4777-8777-777777777777';
const CONTACT_METHOD_ID = '88888888-8888-4888-8888-888888888888';
const MEMBERSHIP_ID = '66666666-6666-4666-8666-666666666666';

const MOCK_CONTACT_METHOD: ContactMethodIdentity = {
  id: CONTACT_METHOD_ID,
  customerId: CUSTOMER_ID,
  businessId: BUSINESS_ID,
  type: 'EMAIL',
  value: 'test@example.com',
  label: null,
  isPrimary: true,
  verified: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_CUSTOMER: CustomerWithContacts = {
  id: CUSTOMER_ID,
  businessId: BUSINESS_ID,
  displayName: 'Test Customer',
  status: 'ACTIVE',
  locale: 'en',
  notes: null,
  metadata: null,
  contactMethods: [MOCK_CONTACT_METHOD],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

const mockResolveTenantContext: CustomerHandlerDeps['resolveTenantContext'] =
  () => Promise.resolve({ ok: true, context: MOCK_TENANT_CONTEXT });

const mockResolveTenantContextDenied: CustomerHandlerDeps['resolveTenantContext'] =
  () =>
    Promise.resolve({
      ok: false,
      response: apiError('UNAUTHENTICATED', 'Authentication required', 401),
    });

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeDeps(overrides?: Partial<CustomerHandlerDeps>): CustomerHandlerDeps {
  return {
    crmService: {
      createCustomer: vi.fn().mockResolvedValue(ok(MOCK_CUSTOMER)),
      updateCustomer: vi.fn().mockResolvedValue(ok(MOCK_CUSTOMER)),
      findCustomerById: vi.fn().mockResolvedValue(ok(MOCK_CUSTOMER)),
      listCustomers: vi.fn().mockResolvedValue(ok({ data: [MOCK_CUSTOMER], nextCursor: null })),
      archiveCustomer: vi.fn().mockResolvedValue(ok({ ...MOCK_CUSTOMER, status: 'ARCHIVED' })),
      addContactMethod: vi.fn().mockResolvedValue(ok(MOCK_CONTACT_METHOD)),
      removeContactMethod: vi.fn().mockResolvedValue(ok(MOCK_CONTACT_METHOD)),
      listContactMethods: vi.fn().mockResolvedValue(ok([MOCK_CONTACT_METHOD])),
      findOrCreateByContact: vi.fn().mockResolvedValue(ok(MOCK_CUSTOMER)),
    },
    authzService: {
      requirePermission: vi.fn().mockResolvedValue(ok({ allowed: true })),
    },
    auditService: {
      createAuditEvent: vi.fn().mockResolvedValue(ok({ id: 'audit-1' })),
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
// Tests
// ---------------------------------------------------------------------------

describe('Customer Handler — createCustomerHandlers factory', () => {
  it('returns all 9 handler functions', () => {
    const handlers = createCustomerHandlers(makeDeps());
    expect(handlers.LIST).toBeTypeOf('function');
    expect(handlers.CREATE).toBeTypeOf('function');
    expect(handlers.GET_BY_ID).toBeTypeOf('function');
    expect(handlers.PATCH).toBeTypeOf('function');
    expect(handlers.ARCHIVE).toBeTypeOf('function');
    expect(handlers.LIST_CONTACT_METHODS).toBeTypeOf('function');
    expect(handlers.ADD_CONTACT_METHOD).toBeTypeOf('function');
    expect(handlers.REMOVE_CONTACT_METHOD).toBeTypeOf('function');
    expect(handlers.RESOLVE).toBeTypeOf('function');
  });
});

// ---------------------------------------------------------------------------
// List customers
// ---------------------------------------------------------------------------

describe('Customer Handler — LIST', () => {
  it('returns 200 with customers', async () => {
    const deps = makeDeps();
    const handler = createListCustomersHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/customers`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.data).toHaveLength(1);
  });

  it('returns 401 when context fails', async () => {
    const deps = makeDeps({ resolveTenantContext: mockResolveTenantContextDenied });
    const handler = createListCustomersHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/customers`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when authz denied', async () => {
    const deps = makeDeps();
    vi.mocked(deps.authzService.requirePermission).mockResolvedValueOnce(
      ok({ allowed: false, reason: 'ROLE_NOT_PERMITTED' }),
    );
    const handler = createListCustomersHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/customers`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid businessId param', async () => {
    const deps = makeDeps();
    const handler = createListCustomersHandler(deps);
    const res = await handler(
      makeRequest('GET', 'http://localhost/api/businesses/not-uuid/customers'),
      { businessId: 'not-uuid' },
    );
    expect(res.status).toBe(400);
  });

  it('passes query params to service', async () => {
    const deps = makeDeps();
    const handler = createListCustomersHandler(deps);
    await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/customers?status=ACTIVE&search=john&limit=10&cursor=${CUSTOMER_ID}`),
      { businessId: BUSINESS_ID },
    );
    expect(deps.crmService.listCustomers).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: BUSINESS_ID,
        status: 'ACTIVE',
        search: 'john',
        limit: 10,
        cursor: CUSTOMER_ID,
      }),
    );
  });

  it('returns 400 for invalid status query param', async () => {
    const deps = makeDeps();
    const handler = createListCustomersHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/customers?status=BAD`),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CRM_INPUT');
    expect(deps.crmService.listCustomers).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Create customer
// ---------------------------------------------------------------------------

describe('Customer Handler — CREATE', () => {
  it('returns 201 with created customer', async () => {
    const deps = makeDeps();
    const handler = createPostCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers`, {
        displayName: 'New Customer',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('injects businessId from route param', async () => {
    const deps = makeDeps();
    const handler = createPostCustomerHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers`, {
        displayName: 'New Customer',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(deps.crmService.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BUSINESS_ID, displayName: 'New Customer' }),
    );
  });

  it('returns 400 for missing displayName', async () => {
    const deps = makeDeps();
    const handler = createPostCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers`, {}),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when authz denied', async () => {
    const deps = makeDeps();
    vi.mocked(deps.authzService.requirePermission).mockResolvedValueOnce(
      ok({ allowed: false, reason: 'ROLE_NOT_PERMITTED' }),
    );
    const handler = createPostCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers`, {
        displayName: 'New Customer',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Get customer by ID
// ---------------------------------------------------------------------------

describe('Customer Handler — GET_BY_ID', () => {
  it('returns 200 with customer', async () => {
    const deps = makeDeps();
    const handler = createGetCustomerByIdHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(CUSTOMER_ID);
  });

  it('returns 404 when not found', async () => {
    const deps = makeDeps();
    vi.mocked(deps.crmService.findCustomerById).mockResolvedValueOnce(ok(null));
    const handler = createGetCustomerByIdHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid UUID params', async () => {
    const deps = makeDeps();
    const handler = createGetCustomerByIdHandler(deps);
    const res = await handler(
      makeRequest('GET', 'http://localhost/api/businesses/bad/customers/bad'),
      { businessId: 'bad', customerId: 'bad' },
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Update customer
// ---------------------------------------------------------------------------

describe('Customer Handler — PATCH', () => {
  it('returns 200 with updated customer', async () => {
    const deps = makeDeps();
    const handler = createPatchCustomerHandler(deps);
    const res = await handler(
      makeRequest('PATCH', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}`, {
        displayName: 'Updated Name',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(200);
  });

  it('passes customerId and businessId to service', async () => {
    const deps = makeDeps();
    const handler = createPatchCustomerHandler(deps);
    await handler(
      makeRequest('PATCH', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}`, {
        displayName: 'Updated',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(deps.crmService.updateCustomer).toHaveBeenCalledWith(
      CUSTOMER_ID,
      BUSINESS_ID,
      expect.objectContaining({ displayName: 'Updated' }),
    );
  });

  it('returns 404 when customer not found', async () => {
    const deps = makeDeps();
    vi.mocked(deps.crmService.updateCustomer).mockResolvedValueOnce(
      err('CUSTOMER_NOT_FOUND', 'Customer not found'),
    );
    const handler = createPatchCustomerHandler(deps);
    const res = await handler(
      makeRequest('PATCH', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}`, {
        displayName: 'X',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Archive customer
// ---------------------------------------------------------------------------

describe('Customer Handler — ARCHIVE', () => {
  it('returns 200 with archived customer', async () => {
    const deps = makeDeps();
    const handler = createArchiveCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/archive`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('ARCHIVED');
  });

  it('returns 404 when customer not found', async () => {
    const deps = makeDeps();
    vi.mocked(deps.crmService.archiveCustomer).mockResolvedValueOnce(
      err('CUSTOMER_NOT_FOUND', 'Customer not found'),
    );
    const handler = createArchiveCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/archive`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when authz denied', async () => {
    const deps = makeDeps();
    vi.mocked(deps.authzService.requirePermission).mockResolvedValueOnce(
      ok({ allowed: false, reason: 'ROLE_NOT_PERMITTED' }),
    );
    const handler = createArchiveCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/archive`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// List contact methods
// ---------------------------------------------------------------------------

describe('Customer Handler — LIST_CONTACT_METHODS', () => {
  it('returns 200 with contact methods', async () => {
    const deps = makeDeps();
    const handler = createListContactMethodsHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('passes customerId and businessId to service', async () => {
    const deps = makeDeps();
    const handler = createListContactMethodsHandler(deps);
    await handler(
      makeRequest('GET', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(deps.crmService.listContactMethods).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      businessId: BUSINESS_ID,
    });
  });
});

// ---------------------------------------------------------------------------
// Add contact method
// ---------------------------------------------------------------------------

describe('Customer Handler — ADD_CONTACT_METHOD', () => {
  it('returns 201 with created contact method', async () => {
    const deps = makeDeps();
    const handler = createAddContactMethodHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods`, {
        type: 'PHONE',
        value: '+14155552671',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(201);
  });

  it('injects customerId and businessId from route', async () => {
    const deps = makeDeps();
    const handler = createAddContactMethodHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods`, {
        type: 'EMAIL',
        value: 'new@test.com',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(deps.crmService.addContactMethod).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        businessId: BUSINESS_ID,
        type: 'EMAIL',
        value: 'new@test.com',
      }),
    );
  });

  it('returns 400 for missing type', async () => {
    const deps = makeDeps();
    const handler = createAddContactMethodHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods`, {
        value: 'test@test.com',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate contact method', async () => {
    const deps = makeDeps();
    vi.mocked(deps.crmService.addContactMethod).mockResolvedValueOnce(
      err('CONTACT_METHOD_ALREADY_EXISTS', 'Duplicate'),
    );
    const handler = createAddContactMethodHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods`, {
        type: 'EMAIL',
        value: 'dup@test.com',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Remove contact method
// ---------------------------------------------------------------------------

describe('Customer Handler — REMOVE_CONTACT_METHOD', () => {
  it('returns 200 with deleted contact method', async () => {
    const deps = makeDeps();
    const handler = createRemoveContactMethodHandler(deps);
    const res = await handler(
      makeRequest('DELETE', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods/${CONTACT_METHOD_ID}`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID, contactMethodId: CONTACT_METHOD_ID },
    );
    expect(res.status).toBe(200);
  });

  it('passes customerId, contactMethodId, and businessId to service', async () => {
    const deps = makeDeps();
    const handler = createRemoveContactMethodHandler(deps);
    await handler(
      makeRequest('DELETE', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods/${CONTACT_METHOD_ID}`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID, contactMethodId: CONTACT_METHOD_ID },
    );
    expect(deps.crmService.removeContactMethod).toHaveBeenCalledWith({
      contactMethodId: CONTACT_METHOD_ID,
      customerId: CUSTOMER_ID,
      businessId: BUSINESS_ID,
    });
  });

  it('returns 404 when not found', async () => {
    const deps = makeDeps();
    vi.mocked(deps.crmService.removeContactMethod).mockResolvedValueOnce(
      err('CONTACT_METHOD_NOT_FOUND', 'Not found'),
    );
    const handler = createRemoveContactMethodHandler(deps);
    const res = await handler(
      makeRequest('DELETE', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods/${CONTACT_METHOD_ID}`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID, contactMethodId: CONTACT_METHOD_ID },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid UUID', async () => {
    const deps = makeDeps();
    const handler = createRemoveContactMethodHandler(deps);
    const res = await handler(
      makeRequest('DELETE', 'http://localhost/blah'),
      { businessId: 'bad', customerId: 'bad', contactMethodId: 'bad' },
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Resolve customer
// ---------------------------------------------------------------------------

describe('Customer Handler — RESOLVE', () => {
  it('returns 200 with resolved customer', async () => {
    const deps = makeDeps();
    const handler = createResolveCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/resolve`, {
        type: 'EMAIL',
        value: 'test@example.com',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('injects businessId from route', async () => {
    const deps = makeDeps();
    const handler = createResolveCustomerHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/resolve`, {
        type: 'PHONE',
        value: '+14155552671',
        displayName: 'Auto Created',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(deps.crmService.findOrCreateByContact).toHaveBeenCalledWith({
      businessId: BUSINESS_ID,
      type: 'PHONE',
      value: '+14155552671',
      displayName: 'Auto Created',
    });
  });

  it('returns 400 for missing type', async () => {
    const deps = makeDeps();
    const handler = createResolveCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/resolve`, {
        value: 'test@example.com',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing value', async () => {
    const deps = makeDeps();
    const handler = createResolveCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/resolve`, {
        type: 'EMAIL',
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
    const handler = createResolveCustomerHandler(deps);
    const res = await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/resolve`, {
        type: 'EMAIL',
        value: 'test@example.com',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: tenant mismatch
// ---------------------------------------------------------------------------

describe('Customer Handler — tenant mismatch', () => {
  it('returns 403 when route businessId does not match context', async () => {
    const OTHER_BID = '99999999-9999-4999-8999-999999999999';
    const deps = makeDeps();
    const handler = createListCustomersHandler(deps);
    const res = await handler(
      makeRequest('GET', `http://localhost/api/businesses/${OTHER_BID}/customers`),
      { businessId: OTHER_BID },
    );
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

describe('Customer Handler — audit logging', () => {
  it('calls audit on successful customer create', async () => {
    const deps = makeDeps();
    const handler = createPostCustomerHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers`, {
        displayName: 'New Customer',
      }),
      { businessId: BUSINESS_ID },
    );
    await vi.waitFor(() => {
      expect(deps.auditService.createAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'customer.create',
          targetType: 'customer',
          result: 'SUCCESS',
          businessId: BUSINESS_ID,
        }),
      );
    });
  });

  it('calls audit on successful customer update', async () => {
    const deps = makeDeps();
    const handler = createPatchCustomerHandler(deps);
    await handler(
      makeRequest('PATCH', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}`, {
        displayName: 'Updated',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    await vi.waitFor(() => {
      expect(deps.auditService.createAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'customer.update',
          targetType: 'customer',
          targetId: CUSTOMER_ID,
        }),
      );
    });
  });

  it('calls audit on successful customer archive', async () => {
    const deps = makeDeps();
    const handler = createArchiveCustomerHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/archive`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    await vi.waitFor(() => {
      expect(deps.auditService.createAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'customer.archive',
          targetType: 'customer',
          targetId: CUSTOMER_ID,
        }),
      );
    });
  });

  it('calls audit on successful customer resolve', async () => {
    const deps = makeDeps();
    const handler = createResolveCustomerHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/resolve`, {
        type: 'EMAIL',
        value: 'test@example.com',
      }),
      { businessId: BUSINESS_ID },
    );
    await vi.waitFor(() => {
      expect(deps.auditService.createAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'customer.resolve',
          targetType: 'customer',
        }),
      );
    });
  });

  it('calls audit on successful contact method add', async () => {
    const deps = makeDeps();
    const handler = createAddContactMethodHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods`, {
        type: 'PHONE',
        value: '+14155552671',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    await vi.waitFor(() => {
      expect(deps.auditService.createAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'customer_contact_method.create',
          targetType: 'customer_contact_method',
        }),
      );
    });
  });

  it('calls audit on successful contact method delete', async () => {
    const deps = makeDeps();
    const handler = createRemoveContactMethodHandler(deps);
    await handler(
      makeRequest('DELETE', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods/${CONTACT_METHOD_ID}`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID, contactMethodId: CONTACT_METHOD_ID },
    );
    await vi.waitFor(() => {
      expect(deps.auditService.createAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'customer_contact_method.delete',
          targetType: 'customer_contact_method',
          targetId: CONTACT_METHOD_ID,
        }),
      );
    });
  });

  it('audit delete metadata includes customerId and no PII', async () => {
    const deps = makeDeps();
    const handler = createRemoveContactMethodHandler(deps);
    await handler(
      makeRequest('DELETE', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods/${CONTACT_METHOD_ID}`),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID, contactMethodId: CONTACT_METHOD_ID },
    );
    await vi.waitFor(() => {
      expect(deps.auditService.createAuditEvent).toHaveBeenCalled();
    });
    const call = vi.mocked(deps.auditService.createAuditEvent).mock.calls[0][0];
    const meta = call.metadata as Record<string, unknown>;
    expect(meta).toEqual({
      businessId: BUSINESS_ID,
      customerId: CUSTOMER_ID,
      contactMethodId: CONTACT_METHOD_ID,
    });
    const metadataStr = JSON.stringify(meta);
    expect(metadataStr).not.toContain('test@example.com');
    expect(metadataStr).not.toContain('value');
  });

  it('audit metadata does not include raw contact value', async () => {
    const deps = makeDeps();
    const handler = createAddContactMethodHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers/${CUSTOMER_ID}/contact-methods`, {
        type: 'EMAIL',
        value: 'secret@example.com',
      }),
      { businessId: BUSINESS_ID, customerId: CUSTOMER_ID },
    );
    await vi.waitFor(() => {
      expect(deps.auditService.createAuditEvent).toHaveBeenCalled();
    });
    const call = vi.mocked(deps.auditService.createAuditEvent).mock.calls[0][0];
    const metadataStr = JSON.stringify(call.metadata);
    expect(metadataStr).not.toContain('secret@example.com');
    expect(metadataStr).not.toContain('value');
  });

  it('audit is not called on validation failure', async () => {
    const deps = makeDeps();
    const handler = createPostCustomerHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers`, {}),
      { businessId: BUSINESS_ID },
    );
    expect(deps.auditService.createAuditEvent).not.toHaveBeenCalled();
  });

  it('audit is not called on authz failure', async () => {
    const deps = makeDeps();
    vi.mocked(deps.authzService.requirePermission).mockResolvedValueOnce(
      ok({ allowed: false, reason: 'ROLE_NOT_PERMITTED' }),
    );
    const handler = createPostCustomerHandler(deps);
    await handler(
      makeRequest('POST', `http://localhost/api/businesses/${BUSINESS_ID}/customers`, {
        displayName: 'Test',
      }),
      { businessId: BUSINESS_ID },
    );
    expect(deps.auditService.createAuditEvent).not.toHaveBeenCalled();
  });
});
