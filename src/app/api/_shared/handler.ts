// ===========================================================================
// API Shared — Handler Boundary Utilities
//
// Safe wrappers for API route handlers.
// ===========================================================================

import { apiError, apiNotImplemented } from './responses';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An API handler function that returns a Response */
export type ApiHandler = () => Promise<Response> | Response;

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

/**
 * Wraps an API handler with a try/catch boundary.
 *
 * On success, returns the handler's response.
 * On error, returns a generic 500 INTERNAL_SERVER_ERROR response.
 *
 * Never exposes internal error details to the client.
 */
export async function withApiErrorBoundary(
  handler: ApiHandler,
): Promise<Response> {
  try {
    return await handler();
  } catch {
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'Internal server error',
      500,
    );
  }
}

// ---------------------------------------------------------------------------
// Not implemented factory
// ---------------------------------------------------------------------------

/**
 * Creates a handler function that returns a NOT_IMPLEMENTED response.
 *
 * Utility for future route refactoring. Not applied to route files in this task.
 */
export function notImplementedHandler(
  endpoint: string,
): () => Promise<Response> {
  return async () => apiNotImplemented(endpoint);
}
