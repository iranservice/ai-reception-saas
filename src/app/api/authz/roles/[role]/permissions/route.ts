// ===========================================================================
// Authz — GET /api/authz/roles/:role/permissions
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function GET(): Promise<Response> {
  return apiNotImplemented('GET /api/authz/roles/:role/permissions');
}
