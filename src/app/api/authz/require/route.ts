// ===========================================================================
// Authz — POST /api/authz/require
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function POST(): Promise<Response> {
  return apiNotImplemented('POST /api/authz/require');
}
