// ===========================================================================
// Service Requests — PATCH .../service-requests/:requestId/status
//
// Feature-gated route wiring for service request status update handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createPatchServiceRequestStatusHandler } from '../../handler';

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string; requestId: string }> },
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented(
      'PATCH /api/businesses/:businessId/service-requests/:requestId/status',
    );
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createPatchServiceRequestStatusHandler({
      ordersService: deps.services.orders,
      authzService: deps.services.authz,
    });
    return handler(request, context);
  });
}
