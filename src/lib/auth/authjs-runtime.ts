/**
 * Auth.js Runtime — Shared Auth Session Accessor
 *
 * Provides a lazy-initialized accessor for the Auth.js `auth` function
 * returned by `NextAuth()`. The route handler initialization sets this
 * once via `setAuthjsAuth()`, and the request-context adapter reads it
 * via `getAuthjsAuth()`.
 *
 * This module does NOT import `next-auth` — it only holds a reference
 * to the `auth` function provided at runtime.
 *
 * TASK-0039: Created for Auth.js request-context resolver integration.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The `auth` function signature returned by `NextAuth()`.
 *
 * In practice this is `NextAuthResult['auth']`, but we use a loose
 * function type here to avoid importing `next-auth` in this module.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AuthjsAuthFunction = (...args: any[]) => any;

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let authjsAuth: AuthjsAuthFunction | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the Auth.js `auth` function, or `null` if Auth.js runtime
 * has not been initialized yet.
 *
 * The `auth` function is set during route handler initialization
 * via `setAuthjsAuth()`.
 */
export function getAuthjsAuth(): AuthjsAuthFunction | null {
  return authjsAuth;
}

/**
 * Registers the Auth.js `auth` function from the `NextAuth()` result.
 *
 * Called once during route handler initialization. Subsequent calls
 * overwrite the previous value (supports hot-reload scenarios).
 *
 * @param auth - The `auth` function from `NextAuth()`.
 */
export function setAuthjsAuth(auth: AuthjsAuthFunction): void {
  authjsAuth = auth;
}

/**
 * Resets the Auth.js auth function to `null`.
 *
 * **Test-only.** Used in test teardown to ensure test isolation.
 */
export function resetAuthjsAuthForTests(): void {
  authjsAuth = null;
}
