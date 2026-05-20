// ===========================================================================
// Tests — Catalog + Orders Authz Permission Verification
//
// Verifies that new permissions (catalog.read, orders.*) are correctly
// assigned to each role and that no role has excessive access.
// ===========================================================================

import { describe, it, expect } from 'vitest';

import { AUTHZ_PERMISSION_VALUES } from '../../src/domains/authz/types';
import { ROLE_PERMISSIONS } from '../../src/domains/authz/permissions';
import { createAuthzService } from '../../src/domains/authz/implementation';

const MOCK_IDS = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  businessId: '550e8400-e29b-41d4-a716-446655440002',
};

// ===========================================================================
// Permission registry tests
// ===========================================================================

describe('Catalog + Orders permission registry', () => {
  it('AUTHZ_PERMISSION_VALUES includes catalog.read', () => {
    expect(AUTHZ_PERMISSION_VALUES).toContain('catalog.read');
  });

  it('AUTHZ_PERMISSION_VALUES includes orders.read', () => {
    expect(AUTHZ_PERMISSION_VALUES).toContain('orders.read');
  });

  it('AUTHZ_PERMISSION_VALUES includes orders.create', () => {
    expect(AUTHZ_PERMISSION_VALUES).toContain('orders.create');
  });

  it('AUTHZ_PERMISSION_VALUES includes orders.update_status', () => {
    expect(AUTHZ_PERMISSION_VALUES).toContain('orders.update_status');
  });
});

// ===========================================================================
// Role permission mapping tests
// ===========================================================================

describe('OWNER role', () => {
  it('has catalog.read', () => {
    expect(ROLE_PERMISSIONS.OWNER).toContain('catalog.read');
  });

  it('has orders.read', () => {
    expect(ROLE_PERMISSIONS.OWNER).toContain('orders.read');
  });

  it('has orders.create', () => {
    expect(ROLE_PERMISSIONS.OWNER).toContain('orders.create');
  });

  it('has orders.update_status', () => {
    expect(ROLE_PERMISSIONS.OWNER).toContain('orders.update_status');
  });
});

describe('ADMIN role', () => {
  it('has catalog.read', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain('catalog.read');
  });

  it('has orders.read', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain('orders.read');
  });

  it('has orders.create', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain('orders.create');
  });

  it('has orders.update_status', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain('orders.update_status');
  });
});

describe('OPERATOR role', () => {
  it('has catalog.read', () => {
    expect(ROLE_PERMISSIONS.OPERATOR).toContain('catalog.read');
  });

  it('has orders.read', () => {
    expect(ROLE_PERMISSIONS.OPERATOR).toContain('orders.read');
  });

  it('has orders.create', () => {
    expect(ROLE_PERMISSIONS.OPERATOR).toContain('orders.create');
  });

  it('does NOT have orders.update_status', () => {
    expect(ROLE_PERMISSIONS.OPERATOR).not.toContain('orders.update_status');
  });
});

describe('VIEWER role', () => {
  it('has catalog.read', () => {
    expect(ROLE_PERMISSIONS.VIEWER).toContain('catalog.read');
  });

  it('has orders.read', () => {
    expect(ROLE_PERMISSIONS.VIEWER).toContain('orders.read');
  });

  it('does NOT have orders.create', () => {
    expect(ROLE_PERMISSIONS.VIEWER).not.toContain('orders.create');
  });

  it('does NOT have orders.update_status', () => {
    expect(ROLE_PERMISSIONS.VIEWER).not.toContain('orders.update_status');
  });
});

// ===========================================================================
// AuthzService integration tests for new permissions
// ===========================================================================

describe('AuthzService — catalog/orders access checks', () => {
  const authz = createAuthzService();

  it('OWNER can orders.update_status', async () => {
    const result = await authz.evaluateAccess({
      ...MOCK_IDS,
      role: 'OWNER',
      permission: 'orders.update_status',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.allowed).toBe(true);
  });

  it('ADMIN can orders.update_status', async () => {
    const result = await authz.evaluateAccess({
      ...MOCK_IDS,
      role: 'ADMIN',
      permission: 'orders.update_status',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.allowed).toBe(true);
  });

  it('OPERATOR cannot orders.update_status', async () => {
    const result = await authz.evaluateAccess({
      ...MOCK_IDS,
      role: 'OPERATOR',
      permission: 'orders.update_status',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.allowed).toBe(false);
  });

  it('VIEWER cannot orders.create', async () => {
    const result = await authz.evaluateAccess({
      ...MOCK_IDS,
      role: 'VIEWER',
      permission: 'orders.create',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.allowed).toBe(false);
  });

  it('VIEWER can catalog.read', async () => {
    const result = await authz.evaluateAccess({
      ...MOCK_IDS,
      role: 'VIEWER',
      permission: 'catalog.read',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.allowed).toBe(true);
  });

  it('OPERATOR can orders.create', async () => {
    const result = await authz.evaluateAccess({
      ...MOCK_IDS,
      role: 'OPERATOR',
      permission: 'orders.create',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.allowed).toBe(true);
  });
});
