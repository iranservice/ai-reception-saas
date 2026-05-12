// ===========================================================================
// Memberships — DELETE /api/businesses/:businessId/memberships/:membershipId
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function DELETE(): Promise<Response> {
  return apiNotImplemented(
    'DELETE /api/businesses/:businessId/memberships/:membershipId',
  );
}
