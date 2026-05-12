// ===========================================================================
// Identity — POST /api/identity/sessions/:sessionId/revoke
//
// Feature-gated route wiring for session revocation handler.
// When disabled: returns NOT_IMPLEMENTED (501)
// When enabled: resolves context then delegates to handler module
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createPostRevokeIdentitySessionHandler } from '../../handler';

// ---------------------------------------------------------------------------
// Route context type
// ---------------------------------------------------------------------------

type RevokeRouteContext = {
  params: Promise<{ sessionId: string }>;
};

async function resolveRouteParams(
  context: RevokeRouteContext,
): Promise<{ sessionId: string }> {
  return await context.params;
}

// ---------------------------------------------------------------------------
// Route export
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  context: RevokeRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented(
      'POST /api/identity/sessions/:sessionId/revoke',
    );
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createPostRevokeIdentitySessionHandler({
      identityService: deps.services.identity,
    });
    return handler(request, params);
  });
}
