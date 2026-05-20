// ===========================================================================
// Catalog Domain — Service Implementation
//
// Wires the catalog repository into the CatalogService interface.
// Read-only for MVP — delegates directly to repository.
// ===========================================================================

import type { CatalogService } from './service';
import type { CatalogRepository } from './repository';

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface CatalogServiceDeps {
  readonly repository: CatalogRepository;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCatalogService(deps: CatalogServiceDeps): CatalogService {
  return {
    findCategoryById: (input) => deps.repository.findCategoryById(input),
    findCategoryBySlug: (input) => deps.repository.findCategoryBySlug(input),
    listCategories: (input) => deps.repository.listCategories(input),
    findServiceById: (input) => deps.repository.findServiceById(input),
    findServiceBySlug: (input) => deps.repository.findServiceBySlug(input),
    listServices: (input) => deps.repository.listServices(input),
  };
}
