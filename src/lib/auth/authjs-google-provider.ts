/**
 * Auth.js Google Provider Configuration
 *
 * Provides Google OAuth provider primitives gated behind
 * `ENABLE_AUTHJS_GOOGLE_PROVIDER`. Google provider is only added
 * to the Auth.js providers array when the provider flag is enabled.
 *
 * Flag semantics: only the exact string `"true"` enables.
 * No trimming, no case normalization, no numeric truthy.
 *
 * Credential validation: `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
 * are required only when the provider flag is enabled. Validation
 * follows the same pattern as `validateAuthjsSecret`.
 *
 * TASK-0036: Provider configuration only — no middleware, no UI,
 * no request-context integration.
 *
 * @module
 */

import Google from 'next-auth/providers/google';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Validated Google OAuth client credentials.
 */
export interface GoogleProviderCredentials {
  /** Google OAuth client ID */
  clientId: string;
  /** Google OAuth client secret */
  clientSecret: string;
}

/**
 * Environment record subset used by Google provider configuration.
 * Accepts injection for testing without mutating process.env.
 */
export interface GoogleProviderEnv {
  ENABLE_AUTHJS_GOOGLE_PROVIDER?: string;
  AUTH_GOOGLE_ID?: string;
  AUTH_GOOGLE_SECRET?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Environment variable name that controls Google provider enablement.
 * Set to exactly `"true"` to enable.
 */
export const AUTHJS_GOOGLE_PROVIDER_FEATURE_FLAG =
  'ENABLE_AUTHJS_GOOGLE_PROVIDER' as const;

/**
 * Provider ID for Google OAuth.
 */
export const AUTHJS_GOOGLE_PROVIDER_ID = 'google' as const;

/**
 * Error message when AUTH_GOOGLE_ID is missing or empty.
 */
export const AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE =
  'AUTH_GOOGLE_ID is required when ENABLE_AUTHJS_GOOGLE_PROVIDER is enabled. ' +
  'Provide a valid Google OAuth client ID.';

/**
 * Error message when AUTH_GOOGLE_SECRET is missing or empty.
 */
export const AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE =
  'AUTH_GOOGLE_SECRET is required when ENABLE_AUTHJS_GOOGLE_PROVIDER is enabled. ' +
  'Provide a valid Google OAuth client secret.';

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the Google provider feature flag is enabled.
 *
 * Only the exact string `"true"` enables the flag.
 * No trimming, no case normalization, no numeric truthy.
 *
 * @param env - Environment record to read from (defaults to process.env).
 *              Accepts injection for testing without mutating process.env.
 */
export function isAuthjsGoogleProviderEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[AUTHJS_GOOGLE_PROVIDER_FEATURE_FLAG] === 'true';
}

// ---------------------------------------------------------------------------
// Credential validation
// ---------------------------------------------------------------------------

/**
 * Validates that Google OAuth credentials are present and non-empty.
 *
 * @param env - Environment record to read from (defaults to process.env).
 * @returns Validated credentials with trimmed values.
 * @throws {Error} if AUTH_GOOGLE_ID is missing or empty
 * @throws {Error} if AUTH_GOOGLE_SECRET is missing or empty
 */
export function validateGoogleProviderCredentials(
  env: Record<string, string | undefined> = process.env,
): GoogleProviderCredentials {
  const clientId = env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = env.AUTH_GOOGLE_SECRET?.trim();

  if (!clientId) {
    throw new Error(AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE);
  }

  if (!clientSecret) {
    throw new Error(AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE);
  }

  return { clientId, clientSecret };
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Creates a Google OAuth provider config from validated credentials.
 *
 * @param credentials - Validated Google OAuth client credentials.
 * @returns Opaque Auth.js provider config object.
 */
export function createGoogleAuthProvider(
  credentials: GoogleProviderCredentials,
): unknown {
  return Google({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  });
}

// ---------------------------------------------------------------------------
// Providers array builder
// ---------------------------------------------------------------------------

/**
 * Builds the Auth.js providers array based on provider feature flags.
 *
 * When `ENABLE_AUTHJS_GOOGLE_PROVIDER === "true"`:
 * - Validates Google credentials
 * - Creates Google provider config
 * - Adds it to the providers array
 *
 * When the flag is disabled or not set:
 * - Returns an empty array (Auth.js runtime runs with no real providers)
 *
 * @param env - Environment record to read from (defaults to process.env).
 * @returns Array of Auth.js provider config objects.
 * @throws {Error} if Google provider flag is enabled but credentials are missing
 */
export function createAuthjsProviders(
  env: Record<string, string | undefined> = process.env,
): unknown[] {
  const providers: unknown[] = [];

  if (isAuthjsGoogleProviderEnabled(env)) {
    const credentials = validateGoogleProviderCredentials(env);
    providers.push(createGoogleAuthProvider(credentials));
  }

  return providers;
}
