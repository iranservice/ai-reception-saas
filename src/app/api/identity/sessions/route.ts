// ===========================================================================
// Identity — POST/GET /api/identity/sessions
//
// Feature-gated route wiring for identity session handlers.
// When disabled: returns NOT_IMPLEMENTED (501)
// When enabled: resolves context then delegates to handler module
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import {
  createPostIdentitySessionsHandler,
  createGetIdentitySessionsHandler,
} from './handler';

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('POST /api/identity/sessions');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createPostIdentitySessionsHandler({
      identityService: deps.services.identity,
    });
    return handler(request);
  });
}

export async function GET(request: Request): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/identity/sessions');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const handler = createGetIdentitySessionsHandler({
      identityService: deps.services.identity,
    });
    return handler(request);
  });
}
