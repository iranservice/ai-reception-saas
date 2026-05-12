// ===========================================================================
// API Shared — Route Handler Wrapper
//
// Placeholder-safe route wrappers that check the feature gate before
// calling real handler implementations.
// ===========================================================================

import { apiNotImplemented } from './responses';
import { areApiHandlersEnabled } from './feature-gate';
import { withApiErrorBoundary } from './handler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A route handler function that returns a Response */
export type RouteHandler = () => Promise<Response> | Response;

/** Options for creating a feature-gated route handler */
export interface FeatureGatedRouteOptions {
  /** Endpoint identifier for NOT_IMPLEMENTED messages (e.g. "GET /api/identity/me") */
  readonly endpoint: string;
  /** The handler to call when the feature gate is enabled */
  readonly handler: RouteHandler;
  /** Optional environment object for testing */
  readonly env?: Record<string, string | undefined>;
}

// ---------------------------------------------------------------------------
// Feature-gated route factory
// ---------------------------------------------------------------------------

/**
 * Creates a feature-gated route handler.
 *
 * - When ENABLE_API_HANDLERS is not "true": returns NOT_IMPLEMENTED
 * - When enabled: calls the handler wrapped in an error boundary
 *
 * The handler is never called when the gate is disabled.
 */
export function createFeatureGatedRoute(
  options: FeatureGatedRouteOptions,
): () => Promise<Response> {
  return async () => {
    if (!areApiHandlersEnabled(options.env)) {
      return apiNotImplemented(options.endpoint);
    }
    return withApiErrorBoundary(options.handler);
  };
}

// ---------------------------------------------------------------------------
// Placeholder route factory
// ---------------------------------------------------------------------------

/**
 * Creates a placeholder route that returns NOT_IMPLEMENTED regardless of
 * whether the feature gate is enabled or disabled.
 *
 * This is the default for all routes in TASK-0016.
 * Real handler implementations will replace the inner handler in future tasks.
 */
export function createPlaceholderRoute(
  endpoint: string,
): () => Promise<Response> {
  return createFeatureGatedRoute({
    endpoint,
    handler: () => apiNotImplemented(endpoint),
  });
}
