// ===========================================================================
// Service Requests — GET /api/businesses/:businessId/service-requests/:requestId
//
// Feature-gated route wiring for service request detail handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createGetServiceRequestByIdHandler } from '../handler';

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string; requestId: string }> },
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented(
      'GET /api/businesses/:businessId/service-requests/:requestId',
    );
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createGetServiceRequestByIdHandler({
      ordersService: deps.services.orders,
      authzService: deps.services.authz,
    });
    return handler(request, context);
  });
}
