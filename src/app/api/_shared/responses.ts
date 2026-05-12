// ===========================================================================
// API Shared — Response Helpers
//
// Consistent JSON response envelope for all API routes.
// Matches the ApiSuccess / ApiError contracts from
// docs/api/api-error-contracts.md and src/lib/result.ts.
// ===========================================================================

/** API success envelope */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

/** API error envelope */
export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

/** Union of success and error envelopes */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---------------------------------------------------------------------------
// Response factories
// ---------------------------------------------------------------------------

/** Return a JSON success response */
export function apiOk<T>(data: T, init?: ResponseInit): Response {
  const body: ApiSuccess<T> = { ok: true, data };
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(
        new Headers(init?.headers ?? {}).entries(),
      ),
    },
  });
}

/** Return a JSON error response */
export function apiError(
  code: string,
  message: string,
  status: number,
): Response {
  const body: ApiError = { ok: false, error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Return a 501 Not Implemented placeholder response */
export function apiNotImplemented(endpoint: string): Response {
  return apiError(
    'NOT_IMPLEMENTED',
    `${endpoint} is not implemented yet`,
    501,
  );
}
