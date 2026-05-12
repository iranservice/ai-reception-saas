// ===========================================================================
// Memberships — PATCH /api/businesses/:businessId/memberships/:membershipId/status
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function PATCH(): Promise<Response> {
  return apiNotImplemented(
    'PATCH /api/businesses/:businessId/memberships/:membershipId/status',
  );
}
