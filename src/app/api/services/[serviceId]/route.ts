// ===========================================================================
// Catalog — GET /api/services/:serviceId
//
// Feature-gated route wiring for service detail handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createGetServiceByIdHandler } from '../handler';

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  context: { params: Promise<{ serviceId: string }> },
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/services/:serviceId');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createGetServiceByIdHandler({
      catalogService: deps.services.catalog,
    });
    return handler(request, context);
  });
}
