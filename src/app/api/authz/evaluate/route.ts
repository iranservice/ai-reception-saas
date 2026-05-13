// ===========================================================================
// Authz — POST /api/authz/evaluate
//
// Feature-gated route wiring for authz evaluate handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createPostAuthzEvaluateHandler } from '../handler';

export async function POST(request: Request): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('POST /api/authz/evaluate');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createPostAuthzEvaluateHandler({
      authzService: deps.services.authz,
    });
    return handler(request);
  });
}
