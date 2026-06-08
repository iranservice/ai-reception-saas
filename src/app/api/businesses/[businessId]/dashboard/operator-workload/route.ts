// ===========================================================================
// Operator Workload — GET /api/businesses/:businessId/dashboard/operator-workload
//
// Feature-gated route wiring for operator workload handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createGetOperatorWorkloadHandler } from './handler';

type RouteContext = {
  params: Promise<{ businessId: string }>;
};

async function resolveRouteParams(
  context: RouteContext,
): Promise<{ businessId: string }> {
  return await context.params;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented(
      'GET /api/businesses/:businessId/dashboard/operator-workload',
    );
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createGetOperatorWorkloadHandler({
      conversationRepository: deps.repositories.conversations,
      tenancyRepository: deps.repositories.tenancy,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
