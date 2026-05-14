/**
 * Auth.js Runtime Feature Gate
 *
 * Controls whether Auth.js runtime configuration is enabled.
 * The feature flag is read from the environment at call time,
 * allowing safe staged rollout without code changes.
 *
 * IMPORTANT: This gate controls configuration availability only.
 * It does not wire Auth.js into routes, middleware, or request context.
 * Route-wiring is deferred to a future task.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Feature flag name
// ---------------------------------------------------------------------------

/**
 * Environment variable name that controls Auth.js runtime enablement.
 * Set to `'true'` (case-insensitive) to enable.
 */
export const AUTHJS_RUNTIME_FEATURE_FLAG = 'ENABLE_AUTHJS_RUNTIME' as const;

// ---------------------------------------------------------------------------
// Gate check
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the Auth.js runtime feature flag is enabled.
 *
 * Reads `process.env.ENABLE_AUTHJS_RUNTIME` at call time.
 * Accepts `'true'` or `'1'` (case-insensitive). All other values
 * (including missing/undefined) return `false`.
 */
export function isAuthjsRuntimeEnabled(): boolean {
  const value = process.env[AUTHJS_RUNTIME_FEATURE_FLAG];
  if (value === undefined || value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

// ---------------------------------------------------------------------------
// Guard helper
// ---------------------------------------------------------------------------

/**
 * Error thrown when Auth.js runtime features are accessed while disabled.
 */
export class AuthjsRuntimeDisabledError extends Error {
  constructor(operation: string) {
    super(
      `Auth.js runtime is disabled. Set ${AUTHJS_RUNTIME_FEATURE_FLAG}=true to enable. ` +
        `Attempted operation: ${operation}`,
    );
    this.name = 'AuthjsRuntimeDisabledError';
  }
}

/**
 * Asserts that Auth.js runtime is enabled. Throws if disabled.
 *
 * @throws {AuthjsRuntimeDisabledError} if feature flag is not enabled
 */
export function assertAuthjsRuntimeEnabled(operation: string): void {
  if (!isAuthjsRuntimeEnabled()) {
    throw new AuthjsRuntimeDisabledError(operation);
  }
}
