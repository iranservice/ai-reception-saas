// ===========================================================================
// Memberships — GET/POST /api/businesses/:businessId/memberships
//
// Feature-gated route wiring for business membership handlers.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import {
  createGetBusinessMembershipsHandler,
  createPostBusinessMembershipsHandler,
} from './handler';

type MembershipsRouteContext = {
  params: Promise<{ businessId: string }>;
};

async function resolveRouteParams(
  context: MembershipsRouteContext,
): Promise<{ businessId: string }> {
  return await context.params;
}

export async function GET(
  request: Request,
  context: MembershipsRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/businesses/:businessId/memberships');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createGetBusinessMembershipsHandler({
      tenancyService: deps.services.tenancy,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}

export async function POST(
  request: Request,
  context: MembershipsRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('POST /api/businesses/:businessId/memberships');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createPostBusinessMembershipsHandler({
      tenancyService: deps.services.tenancy,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
