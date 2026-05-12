// ===========================================================================
// Identity — GET/PATCH /api/identity/me
//
// Feature-gated route wiring for identity self-profile handlers.
// When disabled: returns NOT_IMPLEMENTED (501)
// When enabled: resolves context then delegates to handler module
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import {
  createGetIdentityMeHandler,
  createPatchIdentityMeHandler,
} from './handler';

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/identity/me');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createGetIdentityMeHandler({
      identityService: deps.services.identity,
    });
    return handler(request);
  });
}

export async function PATCH(request: Request): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('PATCH /api/identity/me');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createPatchIdentityMeHandler({
      identityService: deps.services.identity,
    });
    return handler(request);
  });
}
