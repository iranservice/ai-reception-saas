// ===========================================================================
// Catalog Domain — Barrel Exports
// ===========================================================================

export type {
  ServiceCategoryIdentity,
  ServiceIdentity,
  ServiceWithCategory,
  FindCategoryByIdInput,
  FindCategoryBySlugInput,
  ListCategoriesInput,
  FindServiceByIdInput,
  FindServiceBySlugInput,
  ListServicesInput,
} from './types';

export type { CatalogService, CatalogErrorCode } from './service';
export { CATALOG_ERROR_CODES } from './service';

export type {
  CatalogRepository,
  CatalogRepositoryDb,
} from './repository';
export { createCatalogRepository } from './repository';

export type { CatalogServiceDeps } from './implementation';
export { createCatalogService } from './implementation';
