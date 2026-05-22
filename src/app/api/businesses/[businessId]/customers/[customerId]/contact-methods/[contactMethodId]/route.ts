// ===========================================================================
// Contact Methods — DELETE /api/businesses/:businessId/customers/:customerId/contact-methods/:contactMethodId
//
// Feature-gated route wiring for contact method removal handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createRemoveContactMethodHandler } from '../../../handler';

type RouteContext = {
  params: Promise<{
    businessId: string;
    customerId: string;
    contactMethodId: string;
  }>;
};

async function resolveRouteParams(
  context: RouteContext,
): Promise<{
  businessId: string;
  customerId: string;
  contactMethodId: string;
}> {
  return await context.params;
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented(
      'DELETE /api/businesses/:businessId/customers/:customerId/contact-methods/:contactMethodId',
    );
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createRemoveContactMethodHandler({
      crmService: deps.services.crm,
      authzService: deps.services.authz,
      auditService: deps.services.audit,
    });
    return handler(request, params);
  });
}
