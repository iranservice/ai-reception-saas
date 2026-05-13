// ===========================================================================
// Memberships — PATCH /api/businesses/:businessId/memberships/:membershipId/status
//
// Feature-gated route wiring for membership status update handler.
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';
import { areApiHandlersEnabled } from '@/app/api/_shared/feature-gate';
import { withApiErrorBoundary } from '@/app/api/_shared/handler';
import { getApiDependencies } from '@/app/api/_shared/composition';
import { createPatchMembershipStatusHandler } from '../../handler';

type MembershipByIdRouteContext = {
  params: Promise<{ businessId: string; membershipId: string }>;
};

async function resolveRouteParams(
  context: MembershipByIdRouteContext,
): Promise<{ businessId: string; membershipId: string }> {
  return await context.params;
}

export async function PATCH(
  request: Request,
  context: MembershipByIdRouteContext,
): Promise<Response> {
  if (!areApiHandlersEnabled()) {
    return apiNotImplemented(
      'PATCH /api/businesses/:businessId/memberships/:membershipId/status',
    );
  }
  return withApiErrorBoundary(async () => {
    const deps = getApiDependencies();
    const params = await resolveRouteParams(context);
    const handler = createPatchMembershipStatusHandler({
      tenancyService: deps.services.tenancy,
      authzService: deps.services.authz,
    });
    return handler(request, params);
  });
}
