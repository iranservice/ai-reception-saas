// ===========================================================================
// Businesses — GET/PATCH /api/businesses/:businessId
//
// Feature-gated route wiring for business by-ID handlers.
// When disabled: returns NOT_IMPLEMENTED (501)
// When enabled: resolves context then delegates to handler module
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import {
  createGetBusinessByIdHandler,
  createPatchBusinessByIdHandler,
} from '../handler';

// ---------------------------------------------------------------------------
// Route context type
// ---------------------------------------------------------------------------

type BusinessRouteContext = {
  params: Promise<{ businessId: string }>;
};

async function resolveRouteParams(
  context: BusinessRouteContext,
): Promise<{ businessId: string }> {
  return await context.params;
}

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  context: BusinessRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/businesses/:businessId');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createGetBusinessByIdHandler({
      tenancyService: deps.services.tenancy,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}

export async function PATCH(
  request: Request,
  context: BusinessRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('PATCH /api/businesses/:businessId');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createPatchBusinessByIdHandler({
      tenancyService: deps.services.tenancy,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
