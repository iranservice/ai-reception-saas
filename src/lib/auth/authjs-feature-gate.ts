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
 * Strictness: Only the exact string `"true"` enables the flag.
 * No trimming, no case normalization, no numeric truthy semantics.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Feature flag name
// ---------------------------------------------------------------------------

/**
 * Environment variable name that controls Auth.js runtime enablement.
 * Set to exactly `"true"` to enable.
 */
export const AUTHJS_RUNTIME_FEATURE_FLAG = 'ENABLE_AUTHJS_RUNTIME' as const;

// ---------------------------------------------------------------------------
// Gate check
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the Auth.js runtime feature flag is enabled.
 *
 * Only the exact string `"true"` enables the flag.
 * No trimming, no case normalization, no numeric truthy.
 *
 * @param env - Environment record to read from (defaults to process.env).
 *              Accepts injection for testing without mutating process.env.
 */
export function isAuthjsRuntimeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[AUTHJS_RUNTIME_FEATURE_FLAG] === 'true';
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
 * @param operation - Name of the operation being guarded
 * @param env - Environment record to read from (defaults to process.env)
 * @throws {AuthjsRuntimeDisabledError} if feature flag is not enabled
 */
export function assertAuthjsRuntimeEnabled(
  operation: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (!isAuthjsRuntimeEnabled(env)) {
    throw new AuthjsRuntimeDisabledError(operation);
  }
}
