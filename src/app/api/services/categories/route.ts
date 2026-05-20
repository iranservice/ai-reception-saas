// ===========================================================================
// Catalog — GET /api/services/categories
//
// Feature-gated route wiring for catalog category handlers.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createGetCategoriesHandler } from '../handler';

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/services/categories');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createGetCategoriesHandler({
      catalogService: deps.services.catalog,
    });
    return handler(request);
  });
}
