// ===========================================================================
// Audit — GET /api/businesses/:businessId/audit-events/:auditEventId
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function GET(): Promise<Response> {
  return apiNotImplemented(
    'GET /api/businesses/:businessId/audit-events/:auditEventId',
  );
}
