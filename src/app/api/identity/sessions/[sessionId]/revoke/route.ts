// ===========================================================================
// Identity — POST /api/identity/sessions/:sessionId/revoke
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function POST(): Promise<Response> {
  return apiNotImplemented('POST /api/identity/sessions/:sessionId/revoke');
}
