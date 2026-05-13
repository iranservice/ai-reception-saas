// ===========================================================================
// Authz — POST /api/authz/require
//
// Feature-gated route wiring for authz require handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createPostAuthzRequireHandler } from '../handler';

export async function POST(request: Request): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('POST /api/authz/require');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createPostAuthzRequireHandler({
      authzService: deps.services.authz,
    });
    return handler(request);
  });
}
