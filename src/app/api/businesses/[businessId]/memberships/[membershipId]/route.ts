// ===========================================================================
// Memberships — DELETE /api/businesses/:businessId/memberships/:membershipId
//
// Feature-gated route wiring for membership deletion handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createDeleteMembershipHandler } from '../handler';

type MembershipByIdRouteContext = {
  params: Promise<{ businessId: string; membershipId: string }>;
};

async function resolveRouteParams(
  context: MembershipByIdRouteContext,
): Promise<{ businessId: string; membershipId: string }> {
  return await context.params;
}

export async function DELETE(
  request: Request,
  context: MembershipByIdRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented(
      'DELETE /api/businesses/:businessId/memberships/:membershipId',
    );
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createDeleteMembershipHandler({
      tenancyService: deps.services.tenancy,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
