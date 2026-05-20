// ===========================================================================
// Service Requests — POST/GET /api/businesses/:businessId/service-requests
//
// Feature-gated route wiring for service request handlers.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import {
  createPostServiceRequestHandler,
  createGetServiceRequestsHandler,
} from './handler';

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('POST /api/businesses/:businessId/service-requests');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createPostServiceRequestHandler({
      ordersService: deps.services.orders,
      authzService: deps.services.authz,
    });
    return handler(request, context);
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/businesses/:businessId/service-requests');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createGetServiceRequestsHandler({
      ordersService: deps.services.orders,
      authzService: deps.services.authz,
    });
    return handler(request, context);
  });
}
