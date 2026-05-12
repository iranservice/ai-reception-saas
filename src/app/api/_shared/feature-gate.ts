// ===========================================================================
// API Shared — Feature Gate
//
// Controls whether API route handlers use real implementations or
// return NOT_IMPLEMENTED placeholders.
// ===========================================================================

/** Environment variable name that controls the API handler feature gate */
export const API_HANDLERS_FEATURE_FLAG = 'ENABLE_API_HANDLERS';

/**
 * Returns true only when ENABLE_API_HANDLERS is exactly "true".
 *
 * @param env - Optional environment object (defaults to process.env)
 */
export function areApiHandlersEnabled(
  env?: Record<string, string | undefined>,
): boolean {
  const source = env ?? process.env;
  return source[API_HANDLERS_FEATURE_FLAG] === 'true';
}

/**
 * Convenience wrapper that checks if API handlers are enabled.
 * Returns the boolean result without throwing.
 */
export function requireApiHandlersEnabled(): boolean {
  return areApiHandlersEnabled();
}
