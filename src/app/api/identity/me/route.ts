// ===========================================================================
// Identity — GET/PATCH /api/identity/me
// ===========================================================================

import { apiNotImplemented } from '@/app/api/_shared/responses';

export async function GET(): Promise<Response> {
  return apiNotImplemented('GET /api/identity/me');
}

export async function PATCH(): Promise<Response> {
  return apiNotImplemented('PATCH /api/identity/me');
}
