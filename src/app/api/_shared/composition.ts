// ===========================================================================
// API Shared — Composition Root
//
// Wires Prisma -> repositories -> services for the API layer.
// Provides lazy singleton access and test reset utility.
//
// Route handlers do NOT import this yet — this is prepared for future use.
// ===========================================================================

import { getPrisma } from '@/lib/prisma';

import {
  createIdentityRepository,
  type IdentityRepositoryDb,
} from '@/domains/identity/repository';
import {
  createTenancyRepository,
  type TenancyRepositoryDb,
} from '@/domains/tenancy/repository';
import {
  createAuditRepository,
  type AuditRepositoryDb,
} from '@/domains/audit/repository';
import {
  createCatalogRepository,
  type CatalogRepositoryDb,
} from '@/domains/catalog/repository';
import {
  createOrdersRepository,
  type OrdersRepositoryDb,
} from '@/domains/orders/repository';

import { createIdentityService } from '@/domains/identity/implementation';
import { createTenancyService } from '@/domains/tenancy/implementation';
import { createAuthzService } from '@/domains/authz/implementation';
import { createAuditService } from '@/domains/audit/implementation';
import { createCatalogService } from '@/domains/catalog/implementation';
import { createOrdersService } from '@/domains/orders/implementation';

import type {
  ApiDependencies,
  ApiCompositionOptions,
  PrismaCompatibleClient,
} from './composition.types';

// ---------------------------------------------------------------------------
// Prisma -> Repository DB adapters
// ---------------------------------------------------------------------------

/** Extracts only the delegates required by IdentityRepositoryDb */
function toIdentityRepositoryDb(
  prisma: PrismaCompatibleClient,
): IdentityRepositoryDb {
  return {
    user: prisma.user,
    session: prisma.session,
  };
}

/** Extracts only the delegates required by TenancyRepositoryDb */
function toTenancyRepositoryDb(
  prisma: PrismaCompatibleClient,
): TenancyRepositoryDb {
  return {
    business: prisma.business,
    businessMembership: prisma.businessMembership,
  };
}

/** Extracts only the delegates required by AuditRepositoryDb */
function toAuditRepositoryDb(
  prisma: PrismaCompatibleClient,
): AuditRepositoryDb {
  return {
    auditEvent: prisma.auditEvent,
  };
}

/** Extracts only the delegates required by CatalogRepositoryDb */
function toCatalogRepositoryDb(
  prisma: PrismaCompatibleClient,
): CatalogRepositoryDb {
  return {
    serviceCategory: prisma.serviceCategory,
    service: prisma.service,
  };
}

/** Extracts only the delegates required by OrdersRepositoryDb */
function toOrdersRepositoryDb(
  prisma: PrismaCompatibleClient,
): OrdersRepositoryDb {
  return {
    serviceRequest: prisma.serviceRequest,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a fully wired API dependency container.
 *
 * @param options - Optional overrides (e.g., mock prisma for tests)
 * @returns ApiDependencies with repositories and services
 */
export function createApiDependencies(
  options?: ApiCompositionOptions,
): ApiDependencies {
  const prisma = (options?.prisma ??
    getPrisma()) as unknown as PrismaCompatibleClient;

  // Wire repositories
  const identityRepository = createIdentityRepository(
    toIdentityRepositoryDb(prisma),
  );
  const tenancyRepository = createTenancyRepository(
    toTenancyRepositoryDb(prisma),
  );
  const auditRepository = createAuditRepository(
    toAuditRepositoryDb(prisma),
  );
  const catalogRepository = createCatalogRepository(
    toCatalogRepositoryDb(prisma),
  );
  const ordersRepository = createOrdersRepository(
    toOrdersRepositoryDb(prisma),
  );

  // Wire services
  const identityService = createIdentityService({
    repository: identityRepository,
  });
  const tenancyService = createTenancyService({
    repository: tenancyRepository,
  });
  const authzService = createAuthzService();
  const auditService = createAuditService({
    repository: auditRepository,
  });
  const catalogService = createCatalogService({
    repository: catalogRepository,
  });
  const ordersService = createOrdersService({
    repository: ordersRepository,
  });

  return {
    repositories: {
      identity: identityRepository,
      tenancy: tenancyRepository,
      audit: auditRepository,
      catalog: catalogRepository,
      orders: ordersRepository,
    },
    services: {
      identity: identityService,
      tenancy: tenancyService,
      authz: authzService,
      audit: auditService,
      catalog: catalogService,
      orders: ordersService,
    },
  };
}

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

let _instance: ApiDependencies | null = null;

/**
 * Returns a lazy singleton of ApiDependencies.
 * Creates the container on first call and returns the same instance thereafter.
 */
export function getApiDependencies(): ApiDependencies {
  if (!_instance) {
    _instance = createApiDependencies();
  }
  return _instance;
}

/**
 * Clears the singleton for test isolation.
 * Only for use in tests — no effect beyond local module state.
 */
export function resetApiDependenciesForTests(): void {
  _instance = null;
}
