// ===========================================================================
// Tests — Catalog + Orders Domain Services
//
// Verifies catalog read operations, orders CRUD, status transition guards,
// reference number generation, and error propagation.
// ===========================================================================

import { describe, it, expect, vi } from 'vitest';
import { ok, err } from '../../src/lib/result';

import { createCatalogService } from '../../src/domains/catalog/implementation';
import type { CatalogRepository } from '../../src/domains/catalog/repository';
import type { ServiceCategoryIdentity, ServiceIdentity } from '../../src/domains/catalog/types';

import { createOrdersService, generateReferenceNo, isValidTransition } from '../../src/domains/orders/implementation';
import type { OrdersRepository } from '../../src/domains/orders/repository';
import type { ServiceRequestIdentity } from '../../src/domains/orders/types';
import { SERVICE_REQUEST_TRANSITIONS } from '../../src/domains/orders/types';

// ===========================================================================
// Mock data
// ===========================================================================

const MOCK_CATEGORY: ServiceCategoryIdentity = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  name: 'Business Setup',
  nameFA: 'راه‌اندازی کسب‌وکار',
  slug: 'business-setup',
  description: 'Company formation services',
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
};

const MOCK_SERVICE: ServiceIdentity = {
  id: '550e8400-e29b-41d4-a716-446655440011',
  categoryId: MOCK_CATEGORY.id,
  code: 'TAX-001',
  name: 'Corporate Tax Registration',
  nameFA: 'ثبت مالیاتی شرکت',
  slug: 'corporate-tax-registration',
  description: 'Register your company for tax',
  descriptionFA: 'ثبت شرکت برای مالیات',
  estimatedDays: 14,
  basePrice: null,
  currency: 'IRR',
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
};

const MOCK_SERVICE_REQUEST: ServiceRequestIdentity = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  businessId: '550e8400-e29b-41d4-a716-446655440002',
  serviceId: MOCK_SERVICE.id,
  requestedBy: '550e8400-e29b-41d4-a716-446655440000',
  status: 'NEW',
  referenceNo: 'SR-20260515-A3F2K8',
  notes: 'Please expedite',
  metadata: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: '2026-01-15T12:00:00.000Z',
  updatedAt: '2026-01-15T12:00:00.000Z',
};

// ===========================================================================
// Mock factories
// ===========================================================================

function createMockCatalogRepo(): CatalogRepository {
  return {
    findCategoryById: vi.fn().mockResolvedValue(ok(MOCK_CATEGORY)),
    findCategoryBySlug: vi.fn().mockResolvedValue(ok(MOCK_CATEGORY)),
    listCategories: vi.fn().mockResolvedValue(ok([MOCK_CATEGORY])),
    findServiceById: vi.fn().mockResolvedValue(ok(MOCK_SERVICE)),
    findServiceBySlug: vi.fn().mockResolvedValue(ok(MOCK_SERVICE)),
    listServices: vi.fn().mockResolvedValue(ok([MOCK_SERVICE])),
  };
}

function createMockOrdersRepo(): OrdersRepository {
  return {
    createServiceRequest: vi.fn().mockResolvedValue(ok(MOCK_SERVICE_REQUEST)),
    findServiceRequestById: vi.fn().mockResolvedValue(ok(MOCK_SERVICE_REQUEST)),
    listServiceRequests: vi.fn().mockResolvedValue(ok([MOCK_SERVICE_REQUEST])),
    updateServiceRequestStatus: vi.fn().mockResolvedValue(ok({
      ...MOCK_SERVICE_REQUEST,
      status: 'PENDING_DOCUMENTS',
    })),
  };
}

// ===========================================================================
// Catalog Service Tests
// ===========================================================================

describe('Catalog Service', () => {
  it('createCatalogService exists and returns a service', () => {
    const repo = createMockCatalogRepo();
    const service = createCatalogService({ repository: repo });
    expect(service).toBeDefined();
    expect(typeof service.listCategories).toBe('function');
    expect(typeof service.listServices).toBe('function');
    expect(typeof service.findServiceById).toBe('function');
  });

  it('listCategories delegates to repository', async () => {
    const repo = createMockCatalogRepo();
    const service = createCatalogService({ repository: repo });
    const result = await service.listCategories({ includeInactive: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].slug).toBe('business-setup');
    }
    expect(repo.listCategories).toHaveBeenCalledWith({ includeInactive: false });
  });

  it('listServices delegates to repository with categoryId filter', async () => {
    const repo = createMockCatalogRepo();
    const service = createCatalogService({ repository: repo });
    const result = await service.listServices({ categoryId: MOCK_CATEGORY.id });
    expect(result.ok).toBe(true);
    expect(repo.listServices).toHaveBeenCalledWith({ categoryId: MOCK_CATEGORY.id });
  });

  it('findServiceById delegates to repository', async () => {
    const repo = createMockCatalogRepo();
    const service = createCatalogService({ repository: repo });
    const result = await service.findServiceById({ serviceId: MOCK_SERVICE.id });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.slug).toBe('corporate-tax-registration');
    }
  });

  it('findCategoryBySlug delegates to repository', async () => {
    const repo = createMockCatalogRepo();
    const service = createCatalogService({ repository: repo });
    const result = await service.findCategoryBySlug({ slug: 'business-setup' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.name).toBe('Business Setup');
    }
  });

  it('repository error is passed through', async () => {
    const repo = createMockCatalogRepo();
    vi.mocked(repo.listCategories).mockResolvedValueOnce(
      err('CATALOG_REPOSITORY_ERROR', 'DB error'),
    );
    const service = createCatalogService({ repository: repo });
    const result = await service.listCategories({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CATALOG_REPOSITORY_ERROR');
    }
  });
});

// ===========================================================================
// Orders Service Tests
// ===========================================================================

describe('Orders Service', () => {
  it('createOrdersService exists and returns a service', () => {
    const repo = createMockOrdersRepo();
    const service = createOrdersService({ repository: repo });
    expect(service).toBeDefined();
    expect(typeof service.createServiceRequest).toBe('function');
    expect(typeof service.updateServiceRequestStatus).toBe('function');
  });

  it('createServiceRequest generates a reference number and delegates to repository', async () => {
    const repo = createMockOrdersRepo();
    const service = createOrdersService({ repository: repo });
    const result = await service.createServiceRequest({
      businessId: MOCK_SERVICE_REQUEST.businessId,
      serviceId: MOCK_SERVICE_REQUEST.serviceId,
      requestedBy: MOCK_SERVICE_REQUEST.requestedBy,
      notes: 'Test note',
    });
    expect(result.ok).toBe(true);
    expect(repo.createServiceRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: MOCK_SERVICE_REQUEST.businessId,
        serviceId: MOCK_SERVICE_REQUEST.serviceId,
        requestedBy: MOCK_SERVICE_REQUEST.requestedBy,
        notes: 'Test note',
        referenceNo: expect.stringMatching(/^SR-\d{8}-[A-Z2-9]{6}$/),
      }),
    );
  });

  it('findServiceRequestById delegates to repository', async () => {
    const repo = createMockOrdersRepo();
    const service = createOrdersService({ repository: repo });
    const result = await service.findServiceRequestById({ requestId: MOCK_SERVICE_REQUEST.id });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.referenceNo).toBe('SR-20260515-A3F2K8');
    }
  });

  it('listServiceRequests delegates to repository', async () => {
    const repo = createMockOrdersRepo();
    const service = createOrdersService({ repository: repo });
    const result = await service.listServiceRequests({ businessId: MOCK_SERVICE_REQUEST.businessId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
    }
  });

  it('updateServiceRequestStatus allows valid transition NEW → PENDING_DOCUMENTS', async () => {
    const repo = createMockOrdersRepo();
    const service = createOrdersService({ repository: repo });
    const result = await service.updateServiceRequestStatus({
      requestId: MOCK_SERVICE_REQUEST.id,
      status: 'PENDING_DOCUMENTS',
    });
    expect(result.ok).toBe(true);
    expect(repo.updateServiceRequestStatus).toHaveBeenCalledWith({
      requestId: MOCK_SERVICE_REQUEST.id,
      status: 'PENDING_DOCUMENTS',
    });
  });

  it('updateServiceRequestStatus rejects invalid transition NEW → COMPLETED', async () => {
    const repo = createMockOrdersRepo();
    const service = createOrdersService({ repository: repo });
    const result = await service.updateServiceRequestStatus({
      requestId: MOCK_SERVICE_REQUEST.id,
      status: 'COMPLETED',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_SERVICE_REQUEST_TRANSITION');
    }
    expect(repo.updateServiceRequestStatus).not.toHaveBeenCalled();
  });

  it('updateServiceRequestStatus rejects transition from COMPLETED (terminal)', async () => {
    const repo = createMockOrdersRepo();
    vi.mocked(repo.findServiceRequestById).mockResolvedValueOnce(
      ok({ ...MOCK_SERVICE_REQUEST, status: 'COMPLETED' }),
    );
    const service = createOrdersService({ repository: repo });
    const result = await service.updateServiceRequestStatus({
      requestId: MOCK_SERVICE_REQUEST.id,
      status: 'NEW',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_SERVICE_REQUEST_TRANSITION');
    }
  });

  it('updateServiceRequestStatus rejects transition from CANCELLED (terminal)', async () => {
    const repo = createMockOrdersRepo();
    vi.mocked(repo.findServiceRequestById).mockResolvedValueOnce(
      ok({ ...MOCK_SERVICE_REQUEST, status: 'CANCELLED' }),
    );
    const service = createOrdersService({ repository: repo });
    const result = await service.updateServiceRequestStatus({
      requestId: MOCK_SERVICE_REQUEST.id,
      status: 'NEW',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_SERVICE_REQUEST_TRANSITION');
    }
  });

  it('updateServiceRequestStatus returns SERVICE_REQUEST_NOT_FOUND for missing request', async () => {
    const repo = createMockOrdersRepo();
    vi.mocked(repo.findServiceRequestById).mockResolvedValueOnce(ok(null));
    const service = createOrdersService({ repository: repo });
    const result = await service.updateServiceRequestStatus({
      requestId: 'nonexistent',
      status: 'PENDING_DOCUMENTS',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SERVICE_REQUEST_NOT_FOUND');
    }
  });

  it('repository failure during updateServiceRequestStatus is passed through', async () => {
    const repo = createMockOrdersRepo();
    vi.mocked(repo.findServiceRequestById).mockResolvedValueOnce(
      err('ORDERS_REPOSITORY_ERROR', 'DB error'),
    );
    const service = createOrdersService({ repository: repo });
    const result = await service.updateServiceRequestStatus({
      requestId: MOCK_SERVICE_REQUEST.id,
      status: 'PENDING_DOCUMENTS',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ORDERS_REPOSITORY_ERROR');
    }
  });
});

// ===========================================================================
// Reference Number Generation Tests
// ===========================================================================

describe('generateReferenceNo', () => {
  it('returns a string in SR-YYYYMMDD-XXXXXX format', () => {
    const ref = generateReferenceNo();
    expect(ref).toMatch(/^SR-\d{8}-[A-Z2-9]{6}$/);
  });

  it('does not use ambiguous characters (0, O, 1, I)', () => {
    // Generate multiple to reduce flakiness
    for (let i = 0; i < 50; i++) {
      const ref = generateReferenceNo();
      const randomPart = ref.split('-')[2];
      expect(randomPart).not.toMatch(/[01OI]/);
    }
  });

  it('generates different values on successive calls', () => {
    const refs = new Set<string>();
    for (let i = 0; i < 20; i++) {
      refs.add(generateReferenceNo());
    }
    // With 6 chars from 32-char alphabet, collision in 20 is astronomically unlikely
    expect(refs.size).toBeGreaterThanOrEqual(18);
  });
});

// ===========================================================================
// Status Transition Guard Tests
// ===========================================================================

describe('isValidTransition', () => {
  it('allows NEW → PENDING_DOCUMENTS', () => {
    expect(isValidTransition('NEW', 'PENDING_DOCUMENTS')).toBe(true);
  });

  it('allows NEW → UNDER_REVIEW', () => {
    expect(isValidTransition('NEW', 'UNDER_REVIEW')).toBe(true);
  });

  it('allows NEW → CANCELLED', () => {
    expect(isValidTransition('NEW', 'CANCELLED')).toBe(true);
  });

  it('rejects NEW → COMPLETED', () => {
    expect(isValidTransition('NEW', 'COMPLETED')).toBe(false);
  });

  it('allows PENDING_DOCUMENTS → UNDER_REVIEW', () => {
    expect(isValidTransition('PENDING_DOCUMENTS', 'UNDER_REVIEW')).toBe(true);
  });

  it('allows PENDING_DOCUMENTS → CANCELLED', () => {
    expect(isValidTransition('PENDING_DOCUMENTS', 'CANCELLED')).toBe(true);
  });

  it('rejects PENDING_DOCUMENTS → NEW', () => {
    expect(isValidTransition('PENDING_DOCUMENTS', 'NEW')).toBe(false);
  });

  it('allows UNDER_REVIEW → COMPLETED', () => {
    expect(isValidTransition('UNDER_REVIEW', 'COMPLETED')).toBe(true);
  });

  it('allows UNDER_REVIEW → CANCELLED', () => {
    expect(isValidTransition('UNDER_REVIEW', 'CANCELLED')).toBe(true);
  });

  it('rejects UNDER_REVIEW → NEW', () => {
    expect(isValidTransition('UNDER_REVIEW', 'NEW')).toBe(false);
  });

  it('rejects all transitions from COMPLETED (terminal)', () => {
    expect(isValidTransition('COMPLETED', 'NEW')).toBe(false);
    expect(isValidTransition('COMPLETED', 'PENDING_DOCUMENTS')).toBe(false);
    expect(isValidTransition('COMPLETED', 'UNDER_REVIEW')).toBe(false);
    expect(isValidTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('rejects all transitions from CANCELLED (terminal)', () => {
    expect(isValidTransition('CANCELLED', 'NEW')).toBe(false);
    expect(isValidTransition('CANCELLED', 'PENDING_DOCUMENTS')).toBe(false);
    expect(isValidTransition('CANCELLED', 'UNDER_REVIEW')).toBe(false);
    expect(isValidTransition('CANCELLED', 'COMPLETED')).toBe(false);
  });
});

// ===========================================================================
// Transition Map Completeness Test
// ===========================================================================

describe('SERVICE_REQUEST_TRANSITIONS', () => {
  it('has entries for all status values', () => {
    const statuses = ['NEW', 'PENDING_DOCUMENTS', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED'] as const;
    for (const status of statuses) {
      expect(SERVICE_REQUEST_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(SERVICE_REQUEST_TRANSITIONS[status])).toBe(true);
    }
  });

  it('terminal states (COMPLETED, CANCELLED) have empty transition arrays', () => {
    expect(SERVICE_REQUEST_TRANSITIONS.COMPLETED).toHaveLength(0);
    expect(SERVICE_REQUEST_TRANSITIONS.CANCELLED).toHaveLength(0);
  });
});

// ===========================================================================
// Domain Index Export Tests
// ===========================================================================

describe('Catalog Domain Index Exports', () => {
  it('exports createCatalogService', async () => {
    const mod = await import('../../src/domains/catalog');
    expect(mod.createCatalogService).toBeDefined();
    expect(typeof mod.createCatalogService).toBe('function');
  });

  it('exports createCatalogRepository', async () => {
    const mod = await import('../../src/domains/catalog');
    expect(mod.createCatalogRepository).toBeDefined();
    expect(typeof mod.createCatalogRepository).toBe('function');
  });
});

describe('Orders Domain Index Exports', () => {
  it('exports createOrdersService', async () => {
    const mod = await import('../../src/domains/orders');
    expect(mod.createOrdersService).toBeDefined();
    expect(typeof mod.createOrdersService).toBe('function');
  });

  it('exports createOrdersRepository', async () => {
    const mod = await import('../../src/domains/orders');
    expect(mod.createOrdersRepository).toBeDefined();
    expect(typeof mod.createOrdersRepository).toBe('function');
  });

  it('exports SERVICE_REQUEST_STATUS_VALUES', async () => {
    const mod = await import('../../src/domains/orders');
    expect(mod.SERVICE_REQUEST_STATUS_VALUES).toBeDefined();
    expect(mod.SERVICE_REQUEST_STATUS_VALUES).toContain('NEW');
    expect(mod.SERVICE_REQUEST_STATUS_VALUES).toContain('COMPLETED');
  });

  it('exports generateReferenceNo', async () => {
    const mod = await import('../../src/domains/orders');
    expect(mod.generateReferenceNo).toBeDefined();
    expect(typeof mod.generateReferenceNo).toBe('function');
  });

  it('exports isValidTransition', async () => {
    const mod = await import('../../src/domains/orders');
    expect(mod.isValidTransition).toBeDefined();
    expect(typeof mod.isValidTransition).toBe('function');
  });
});
