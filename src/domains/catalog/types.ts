// ===========================================================================
// Catalog Domain — Types
//
// Domain-level type definitions for service categories and services.
// ===========================================================================

// ---------------------------------------------------------------------------
// Const arrays (used for Zod schemas and type guards)
// ---------------------------------------------------------------------------

/** Allowed service category fields for sorting */
export const SERVICE_CATEGORY_SORT_FIELDS = ['sortOrder', 'name'] as const;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Domain representation of a service category */
export interface ServiceCategoryIdentity {
  id: string;
  name: string;
  nameFA: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Domain representation of a service */
export interface ServiceIdentity {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  nameFA: string;
  slug: string;
  description: string | null;
  descriptionFA: string | null;
  estimatedDays: number | null;
  basePrice: string | null; // Decimal serialized as string for precision
  currency: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Service with its parent category included */
export interface ServiceWithCategory extends ServiceIdentity {
  category: ServiceCategoryIdentity;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Input for finding a service category by ID */
export interface FindCategoryByIdInput {
  readonly categoryId: string;
}

/** Input for finding a service category by slug */
export interface FindCategoryBySlugInput {
  readonly slug: string;
}

/** Input for listing active service categories */
export interface ListCategoriesInput {
  readonly includeInactive?: boolean;
}

/** Input for finding a service by ID */
export interface FindServiceByIdInput {
  readonly serviceId: string;
}

/** Input for finding a service by slug */
export interface FindServiceBySlugInput {
  readonly slug: string;
}

/** Input for listing services */
export interface ListServicesInput {
  readonly categoryId?: string;
  readonly includeInactive?: boolean;
}
