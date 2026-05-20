// ===========================================================================
// Catalog Domain — Repository
//
// Prisma-backed persistence layer for service categories and services.
// Uses injected Prisma-compatible client for testability.
// ===========================================================================

import { ok, err } from '@/lib/result';
import type { ActionResult } from '@/lib/result';
import type {
  ServiceCategoryIdentity,
  ServiceIdentity,
  FindCategoryByIdInput,
  FindCategoryBySlugInput,
  ListCategoriesInput,
  FindServiceByIdInput,
  FindServiceBySlugInput,
  ListServicesInput,
} from './types';

// ---------------------------------------------------------------------------
// Local record types
// ---------------------------------------------------------------------------

export interface ServiceCategoryRecord {
  id: string;
  name: string;
  nameFA: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceRecord {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  nameFA: string;
  slug: string;
  description: string | null;
  descriptionFA: string | null;
  estimatedDays: number | null;
  basePrice: { toString(): string } | null; // Prisma Decimal
  currency: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Injected DB client interface
// ---------------------------------------------------------------------------

export interface CatalogRepositoryDb {
  serviceCategory: {
    findUnique(args: {
      where: { id: string } | { slug: string };
    }): Promise<ServiceCategoryRecord | null>;
    findMany(args: {
      where: { isActive?: boolean };
      orderBy: { sortOrder: 'asc' };
    }): Promise<ServiceCategoryRecord[]>;
  };
  service: {
    findUnique(args: {
      where: { id: string } | { slug: string };
    }): Promise<ServiceRecord | null>;
    findMany(args: {
      where: { isActive?: boolean; categoryId?: string };
      orderBy: { sortOrder: 'asc' };
    }): Promise<ServiceRecord[]>;
  };
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface CatalogRepository {
  findCategoryById(
    input: FindCategoryByIdInput,
  ): Promise<ActionResult<ServiceCategoryIdentity | null>>;
  findCategoryBySlug(
    input: FindCategoryBySlugInput,
  ): Promise<ActionResult<ServiceCategoryIdentity | null>>;
  listCategories(
    input: ListCategoriesInput,
  ): Promise<ActionResult<readonly ServiceCategoryIdentity[]>>;
  findServiceById(
    input: FindServiceByIdInput,
  ): Promise<ActionResult<ServiceIdentity | null>>;
  findServiceBySlug(
    input: FindServiceBySlugInput,
  ): Promise<ActionResult<ServiceIdentity | null>>;
  listServices(
    input: ListServicesInput,
  ): Promise<ActionResult<readonly ServiceIdentity[]>>;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapCategoryRecord(
  record: ServiceCategoryRecord,
): ServiceCategoryIdentity {
  return {
    id: record.id,
    name: record.name,
    nameFA: record.nameFA,
    slug: record.slug,
    description: record.description,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapServiceRecord(record: ServiceRecord): ServiceIdentity {
  return {
    id: record.id,
    categoryId: record.categoryId,
    code: record.code,
    name: record.name,
    nameFA: record.nameFA,
    slug: record.slug,
    description: record.description,
    descriptionFA: record.descriptionFA,
    estimatedDays: record.estimatedDays,
    basePrice: record.basePrice ? record.basePrice.toString() : null,
    currency: record.currency,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCatalogRepository(
  db: CatalogRepositoryDb,
): CatalogRepository {
  return {
    async findCategoryById(input) {
      try {
        const record = await db.serviceCategory.findUnique({
          where: { id: input.categoryId },
        });
        return ok(record ? mapCategoryRecord(record) : null);
      } catch {
        return err(
          'CATALOG_REPOSITORY_ERROR',
          'Catalog repository operation failed',
        );
      }
    },

    async findCategoryBySlug(input) {
      try {
        const record = await db.serviceCategory.findUnique({
          where: { slug: input.slug },
        });
        return ok(record ? mapCategoryRecord(record) : null);
      } catch {
        return err(
          'CATALOG_REPOSITORY_ERROR',
          'Catalog repository operation failed',
        );
      }
    },

    async listCategories(input) {
      try {
        const where: { isActive?: boolean } = {};
        if (!input.includeInactive) {
          where.isActive = true;
        }
        const records = await db.serviceCategory.findMany({
          where,
          orderBy: { sortOrder: 'asc' },
        });
        return ok(records.map(mapCategoryRecord));
      } catch {
        return err(
          'CATALOG_REPOSITORY_ERROR',
          'Catalog repository operation failed',
        );
      }
    },

    async findServiceById(input) {
      try {
        const record = await db.service.findUnique({
          where: { id: input.serviceId },
        });
        return ok(record ? mapServiceRecord(record) : null);
      } catch {
        return err(
          'CATALOG_REPOSITORY_ERROR',
          'Catalog repository operation failed',
        );
      }
    },

    async findServiceBySlug(input) {
      try {
        const record = await db.service.findUnique({
          where: { slug: input.slug },
        });
        return ok(record ? mapServiceRecord(record) : null);
      } catch {
        return err(
          'CATALOG_REPOSITORY_ERROR',
          'Catalog repository operation failed',
        );
      }
    },

    async listServices(input) {
      try {
        const where: { isActive?: boolean; categoryId?: string } = {};
        if (!input.includeInactive) {
          where.isActive = true;
        }
        if (input.categoryId) {
          where.categoryId = input.categoryId;
        }
        const records = await db.service.findMany({
          where,
          orderBy: { sortOrder: 'asc' },
        });
        return ok(records.map(mapServiceRecord));
      } catch {
        return err(
          'CATALOG_REPOSITORY_ERROR',
          'Catalog repository operation failed',
        );
      }
    },
  };
}
