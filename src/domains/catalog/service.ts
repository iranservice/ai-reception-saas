// ===========================================================================
// Catalog Domain — Service Interface
//
// Pure service boundary for catalog operations.
// Read-only for MVP — no create/update/delete.
// ===========================================================================

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
// Error codes
// ---------------------------------------------------------------------------

/** Catalog service error code constants */
export const CATALOG_ERROR_CODES = [
  'SERVICE_NOT_FOUND',
  'CATEGORY_NOT_FOUND',
  'INVALID_CATALOG_INPUT',
] as const;

/** Catalog service error code type */
export type CatalogErrorCode = (typeof CATALOG_ERROR_CODES)[number];

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/** Service boundary for catalog (category + service) read operations */
export interface CatalogService {
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
