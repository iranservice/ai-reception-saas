// ===========================================================================
// Audit Events — GET /api/businesses/:businessId/audit-events/:auditEventId
//
// Feature-gated route wiring for tenant audit event detail handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createGetAuditEventByIdHandler } from '../handler';

type AuditEventByIdRouteContext = {
  params: Promise<{ businessId: string; auditEventId: string }>;
};

async function resolveRouteParams(
  context: AuditEventByIdRouteContext,
): Promise<{ businessId: string; auditEventId: string }> {
  return await context.params;
}

export async function GET(
  request: Request,
  context: AuditEventByIdRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented(
      'GET /api/businesses/:businessId/audit-events/:auditEventId',
    );
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createGetAuditEventByIdHandler({
      auditService: deps.services.audit,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
