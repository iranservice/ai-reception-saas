// ===========================================================================
// API Shared — Composition Types
//
// Type definitions for the API dependency container.
// Used by the composition root to wire repositories and services.
// ===========================================================================

import type { IdentityRepository } from '@/domains/identity/repository';
import type { TenancyRepository } from '@/domains/tenancy/repository';
import type { AuditRepository } from '@/domains/audit/repository';
import type { CatalogRepository } from '@/domains/catalog/repository';
import type { OrdersRepository } from '@/domains/orders/repository';

import type { IdentityService } from '@/domains/identity/service';
import type { TenancyService } from '@/domains/tenancy/service';
import type { AuthzService } from '@/domains/authz/service';
import type { AuditService } from '@/domains/audit/service';
import type { CatalogService } from '@/domains/catalog/service';
import type { OrdersService } from '@/domains/orders/service';

import type { IdentityRepositoryDb } from '@/domains/identity/repository';
import type { TenancyRepositoryDb } from '@/domains/tenancy/repository';
import type { AuditRepositoryDb } from '@/domains/audit/repository';
import type { CatalogRepositoryDb } from '@/domains/catalog/repository';
import type { OrdersRepositoryDb } from '@/domains/orders/repository';

// ---------------------------------------------------------------------------
// Container types
// ---------------------------------------------------------------------------

/** All repositories available to API handlers */
export interface ApiRepositories {
  readonly identity: IdentityRepository;
  readonly tenancy: TenancyRepository;
  readonly audit: AuditRepository;
  readonly catalog: CatalogRepository;
  readonly orders: OrdersRepository;
}

/** All services available to API handlers */
export interface ApiServices {
  readonly identity: IdentityService;
  readonly tenancy: TenancyService;
  readonly authz: AuthzService;
  readonly audit: AuditService;
  readonly catalog: CatalogService;
  readonly orders: OrdersService;
}

/** Complete API dependency container */
export interface ApiDependencies {
  readonly repositories: ApiRepositories;
  readonly services: ApiServices;
}

// ---------------------------------------------------------------------------
// Composition options
// ---------------------------------------------------------------------------

/**
 * Prisma-compatible client shape required by the composition root.
 * Combines the delegates needed by all repository DB interfaces.
 */
export interface PrismaCompatibleClient
  extends IdentityRepositoryDb,
    TenancyRepositoryDb,
    AuditRepositoryDb,
    CatalogRepositoryDb,
    OrdersRepositoryDb {}

/** Options for creating the API dependency container */
export interface ApiCompositionOptions {
  /**
   * Prisma-compatible client to use instead of the default getPrisma().
   * Useful for tests that need to inject a mock client.
   */
  readonly prisma?: PrismaCompatibleClient;
}
