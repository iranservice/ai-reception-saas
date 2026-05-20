// ===========================================================================
// Tests — Catalog + Orders Validation Schemas
//
// Verifies Zod schemas for catalog and orders domain inputs.
// ===========================================================================

import { describe, it, expect } from 'vitest';

import {
  catalogSlugSchema,
  listCategoriesInputSchema,
  listServicesInputSchema,
  serviceIdSchema,
  categoryIdSchema,
} from '../../src/domains/catalog/validation';

import {
  serviceRequestStatusSchema,
  createServiceRequestInputSchema,
  updateServiceRequestStatusInputSchema,
  serviceRequestIdSchema,
} from '../../src/domains/orders/validation';

// ===========================================================================
// Catalog Validation Tests
// ===========================================================================

describe('catalogSlugSchema', () => {
  it('accepts valid slug', () => {
    expect(catalogSlugSchema.safeParse('business-setup').success).toBe(true);
  });

  it('accepts slug with numbers', () => {
    expect(catalogSlugSchema.safeParse('30-days-tourist-visa').success).toBe(true);
  });

  it('lowercases uppercase slugs', () => {
    const result = catalogSlugSchema.safeParse('Business-Setup');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('business-setup');
    }
  });

  it('trims whitespace', () => {
    const result = catalogSlugSchema.safeParse('  business-setup  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('business-setup');
    }
  });

  it('rejects too short slug', () => {
    expect(catalogSlugSchema.safeParse('ab').success).toBe(false);
  });

  it('rejects slug starting with hyphen', () => {
    expect(catalogSlugSchema.safeParse('-invalid-slug').success).toBe(false);
  });

  it('rejects slug ending with hyphen', () => {
    expect(catalogSlugSchema.safeParse('invalid-slug-').success).toBe(false);
  });
});

describe('listCategoriesInputSchema', () => {
  it('accepts empty object and defaults includeInactive to false', () => {
    const result = listCategoriesInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeInactive).toBe(false);
    }
  });

  it('accepts explicit includeInactive true', () => {
    const result = listCategoriesInputSchema.safeParse({ includeInactive: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeInactive).toBe(true);
    }
  });
});

describe('listServicesInputSchema', () => {
  it('accepts empty object', () => {
    expect(listServicesInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid categoryId UUID', () => {
    const result = listServicesInputSchema.safeParse({
      categoryId: '550e8400-e29b-41d4-a716-446655440010',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid categoryId', () => {
    expect(
      listServicesInputSchema.safeParse({ categoryId: 'not-a-uuid' }).success,
    ).toBe(false);
  });
});

describe('serviceIdSchema / categoryIdSchema', () => {
  it('accepts valid UUID', () => {
    expect(serviceIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440011').success).toBe(true);
    expect(categoryIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440010').success).toBe(true);
  });

  it('rejects non-UUID', () => {
    expect(serviceIdSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(categoryIdSchema.safeParse('123').success).toBe(false);
  });
});

// ===========================================================================
// Orders Validation Tests
// ===========================================================================

describe('serviceRequestStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const status of ['NEW', 'PENDING_DOCUMENTS', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED']) {
      expect(serviceRequestStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(serviceRequestStatusSchema.safeParse('INVALID').success).toBe(false);
    expect(serviceRequestStatusSchema.safeParse('new').success).toBe(false);
  });
});

describe('createServiceRequestInputSchema', () => {
  it('accepts valid input with serviceId only', () => {
    const result = createServiceRequestInputSchema.safeParse({
      serviceId: '550e8400-e29b-41d4-a716-446655440011',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with serviceId and notes', () => {
    const result = createServiceRequestInputSchema.safeParse({
      serviceId: '550e8400-e29b-41d4-a716-446655440011',
      notes: 'Please expedite',
    });
    expect(result.success).toBe(true);
  });

  it('trims notes whitespace', () => {
    const result = createServiceRequestInputSchema.safeParse({
      serviceId: '550e8400-e29b-41d4-a716-446655440011',
      notes: '  test note  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe('test note');
    }
  });

  it('rejects missing serviceId', () => {
    expect(createServiceRequestInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid serviceId', () => {
    expect(
      createServiceRequestInputSchema.safeParse({ serviceId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('rejects notes exceeding max length', () => {
    expect(
      createServiceRequestInputSchema.safeParse({
        serviceId: '550e8400-e29b-41d4-a716-446655440011',
        notes: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
  });
});

describe('updateServiceRequestStatusInputSchema', () => {
  it('accepts valid requestId + status', () => {
    const result = updateServiceRequestStatusInputSchema.safeParse({
      requestId: '550e8400-e29b-41d4-a716-446655440020',
      status: 'PENDING_DOCUMENTS',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(
      updateServiceRequestStatusInputSchema.safeParse({
        requestId: '550e8400-e29b-41d4-a716-446655440020',
        status: 'INVALID',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid requestId', () => {
    expect(
      updateServiceRequestStatusInputSchema.safeParse({
        requestId: 'not-a-uuid',
        status: 'PENDING_DOCUMENTS',
      }).success,
    ).toBe(false);
  });
});

describe('serviceRequestIdSchema', () => {
  it('accepts valid UUID', () => {
    expect(serviceRequestIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440020').success).toBe(true);
  });

  it('rejects non-UUID', () => {
    expect(serviceRequestIdSchema.safeParse('bad-id').success).toBe(false);
  });
});
