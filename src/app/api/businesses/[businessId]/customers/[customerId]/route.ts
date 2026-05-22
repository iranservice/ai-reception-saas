// ===========================================================================
// Customers — GET/PATCH /api/businesses/:businessId/customers/:customerId
//
// Feature-gated route wiring for customer get-by-ID and update handlers.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import {
  createGetCustomerByIdHandler,
  createPatchCustomerHandler,
} from '../handler';

type RouteContext = {
  params: Promise<{ businessId: string; customerId: string }>;
};

async function resolveRouteParams(
  context: RouteContext,
): Promise<{ businessId: string; customerId: string }> {
  return await context.params;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/businesses/:businessId/customers/:customerId');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createGetCustomerByIdHandler({
      crmService: deps.services.crm,
      authzService: deps.services.authz,
      auditService: deps.services.audit,
    });
    return handler(request, params);
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('PATCH /api/businesses/:businessId/customers/:customerId');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createPatchCustomerHandler({
      crmService: deps.services.crm,
      authzService: deps.services.authz,
      auditService: deps.services.audit,
    });
    return handler(request, params);
  });
}
