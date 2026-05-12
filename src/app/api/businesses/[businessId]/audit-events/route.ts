// ===========================================================================
// Audit — GET /api/businesses/:businessId/audit-events
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function GET(): Promise<Response> {
  return apiNotImplemented('GET /api/businesses/:businessId/audit-events');
}
