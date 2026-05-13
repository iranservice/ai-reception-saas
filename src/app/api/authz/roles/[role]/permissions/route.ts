// ===========================================================================
// Authz — GET /api/authz/roles/:role/permissions
//
// Feature-gated route wiring for role permissions handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createGetRolePermissionsHandler } from '../../../handler';

type RolePermissionsRouteContext = {
  params: Promise<{ role: string }>;
};

async function resolveRouteParams(
  context: RolePermissionsRouteContext,
): Promise<{ role: string }> {
  return await context.params;
}

export async function GET(
  request: Request,
  context: RolePermissionsRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented('GET /api/authz/roles/:role/permissions');
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createGetRolePermissionsHandler({
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
