// ===========================================================================
// Businesses — POST/GET /api/businesses
//
// Feature-gated route wiring for business workspace handlers.
// When disabled: returns NOT_IMPLEMENTED (501)
// When enabled: resolves context then delegates to handler module
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import {
  createPostBusinessesHandler,
  createGetBusinessesHandler,
} from './handler';

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('POST /api/businesses');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createPostBusinessesHandler({
      tenancyService: deps.services.tenancy,
      authzService: deps.services.authz,
    });
    return handler(request);
  });
}

export async function GET(request: Request): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/businesses');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createGetBusinessesHandler({
      tenancyService: deps.services.tenancy,
      authzService: deps.services.authz,
    });
    return handler(request);
  });
}
