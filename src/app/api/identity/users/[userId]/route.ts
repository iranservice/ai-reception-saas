// ===========================================================================
// Identity — GET /api/identity/users/:userId
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function GET(): Promise<Response> {
  return apiNotImplemented('GET /api/identity/users/:userId');
}
