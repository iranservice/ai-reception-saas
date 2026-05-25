// ===========================================================================
// Messages — GET/POST /api/businesses/:businessId/conversations/:conversationId/messages
//
// Feature-gated route wiring for message list and create handlers.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import {
  createListMessagesHandler,
  createPostMessageHandler,
} from '../../handler';

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
    return apiNotImplemented('GET /api/businesses/:businessId/conversations/:conversationId/messages');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createListMessagesHandler({
      conversationService: deps.services.conversations,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('POST /api/businesses/:businessId/conversations/:conversationId/messages');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createPostMessageHandler({
      conversationService: deps.services.conversations,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
