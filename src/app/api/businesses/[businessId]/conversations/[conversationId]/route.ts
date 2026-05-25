// ===========================================================================
// Conversations — GET/PATCH /api/businesses/:businessId/conversations/:conversationId
//
// Feature-gated route wiring for conversation get and update handlers.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import {
  createGetConversationByIdHandler,
  createPatchConversationHandler,
} from '../handler';

type RouteContext = {
  params: Promise<{ businessId: string; conversationId: string }>;
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
    return apiNotImplemented('GET /api/businesses/:businessId/conversations/:conversationId');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createGetConversationByIdHandler({
      conversationService: deps.services.conversations,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('PATCH /api/businesses/:businessId/conversations/:conversationId');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createPatchConversationHandler({
      conversationService: deps.services.conversations,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
