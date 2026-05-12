// ===========================================================================
// Identity — POST/GET /api/identity/sessions
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function POST(): Promise<Response> {
  return apiNotImplemented('POST /api/identity/sessions');
}

export async function GET(): Promise<Response> {
  return apiNotImplemented('GET /api/identity/sessions');
}
