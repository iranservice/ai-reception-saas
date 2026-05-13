// ===========================================================================
// Audit Events — GET /api/businesses/:businessId/audit-events
//
// Feature-gated route wiring for tenant audit event list handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createGetAuditEventsHandler } from './handler';

type AuditEventsRouteContext = {
  params: Promise<{ businessId: string }>;
};

async function resolveRouteParams(
  context: AuditEventsRouteContext,
): Promise<{ businessId: string }> {
  return await context.params;
}

export async function GET(
  request: Request,
  context: AuditEventsRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/businesses/:businessId/audit-events');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createGetAuditEventsHandler({
      auditService: deps.services.audit,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
