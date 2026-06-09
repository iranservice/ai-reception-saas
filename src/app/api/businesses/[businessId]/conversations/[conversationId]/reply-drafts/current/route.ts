// ===========================================================================
// Reply Draft Current — GET route
//
// GET /api/businesses/:businessId/conversations/:conversationId/reply-drafts/current
//
// Feature-gated route wiring for the current draft read handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createCurrentDraftHandler } from './handler';

type RouteContext = {
  params: Promise<{
    businessId: string;
    conversationId: string;
  }>;
};

async function resolveRouteParams(
  context: RouteContext,
): Promise<{ businessId: string; conversationId: string }> {
  return await context.params;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented(
      'GET /api/businesses/:businessId/conversations/:conversationId/reply-drafts/current',
    );
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createCurrentDraftHandler({
      replyDraftRepository: deps.repositories.replyDrafts,
      conversationRepository: deps.repositories.conversations,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
