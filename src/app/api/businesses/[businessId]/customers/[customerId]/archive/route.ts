// ===========================================================================
// Customers — POST /api/businesses/:businessId/customers/:customerId/archive
//
// Feature-gated route wiring for customer archive handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createArchiveCustomerHandler } from '../../handler';

type RouteContext = {
  params: Promise<{ businessId: string; customerId: string }>;
};

async function resolveRouteParams(
  context: RouteContext,
): Promise<{ businessId: string; customerId: string }> {
  return await context.params;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('POST /api/businesses/:businessId/customers/:customerId/archive');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createArchiveCustomerHandler({
      crmService: deps.services.crm,
      authzService: deps.services.authz,
      auditService: deps.services.audit,
    });
    return handler(request, params);
  });
}
