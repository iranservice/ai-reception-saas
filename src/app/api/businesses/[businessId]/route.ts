// ===========================================================================
// Businesses — GET/PATCH /api/businesses/:businessId
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function GET(): Promise<Response> {
  return apiNotImplemented('GET /api/businesses/:businessId');
}

export async function PATCH(): Promise<Response> {
  return apiNotImplemented('PATCH /api/businesses/:businessId');
}
