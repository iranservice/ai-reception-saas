/**
 * Auth.js Shared Lazy Runtime
 *
 * Single source of truth for the Auth.js NextAuth instance.
 * Both the auth route handler and the request-context adapter
 * use this module to access Auth.js — neither owns initialization.
 *
 * Initialization is lazy: the first call to getEnabledAuthjsRuntime()
 * creates and caches the NextAuth instance. Subsequent calls return
 * the cache. The kill-switch (ENABLE_AUTHJS_RUNTIME) is checked
 * on every call before returning cache.
 *
 * TASK-0039: Rewritten from getter/setter to shared lazy runtime.
 *
 * @module
 */

import { assertAuthjsRuntimeEnabled } from './authjs-feature-gate';
import { createAuthjsProviders } from './authjs-google-provider';
import {
  createAuthjsRouteHandlers,
} from './authjs-route-handlers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal session shape matching Auth.js JWT session.
 * Used as the boundary type at the adapter layer.
 */
export interface AuthjsSessionLike {
  readonly user?: {
    readonly id?: string | null;
    readonly email?: string | null;
    readonly name?: string | null;
    readonly image?: string | null;
  } | null;
  readonly expires?: string;
}

/**
 * The fully initialized Auth.js runtime output.
 * Contains route handlers (GET/POST) and the typed session reader.
 */
export interface AuthjsRuntimeOutput {
  /** Whether Auth.js runtime was enabled at creation time */
  enabled: boolean;
  /** GET handler for [...nextauth] route */
  GET: (req: Request) => Promise<Response>;
  /** POST handler for [...nextauth] route */
  POST: (req: Request) => Promise<Response>;
  /** Auth.js session reader — returns session or null */
  auth: ((request: Request) => Promise<AuthjsSessionLike | null>) | null;
}

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let cachedRuntime: AuthjsRuntimeOutput | null = null;

// ---------------------------------------------------------------------------
// Shared lazy runtime
// ---------------------------------------------------------------------------

/**
 * Returns the initialized Auth.js runtime, creating it lazily on first call.
 *
 * Kill-switch semantics: `ENABLE_AUTHJS_RUNTIME` is checked on every call.
 * If disabled after a previous enable, the cache is ignored and an error
 * is thrown — matching the route handler's kill-switch contract.
 *
 * @throws {AuthjsRuntimeDisabledError} if ENABLE_AUTHJS_RUNTIME !== "true"
 */
export async function getEnabledAuthjsRuntime(): Promise<AuthjsRuntimeOutput> {
  // Kill-switch — checked before cache on every call
  assertAuthjsRuntimeEnabled('getEnabledAuthjsRuntime');

  if (cachedRuntime) return cachedRuntime;

  // Build providers (fails fast if provider flag is enabled
  // but credentials are missing — before any DB connection)
  const providers = createAuthjsProviders();

  // Dynamic import to avoid build-time DATABASE_URL requirement
  const { getPrisma } = await import('@/lib/prisma');

  const output = createAuthjsRouteHandlers({
    prisma: getPrisma(),
    authSecret: process.env.AUTH_SECRET ?? '',
    providers,
    basePath: '/api/auth',
    debug: process.env.NODE_ENV === 'development',
  });

  cachedRuntime = output as AuthjsRuntimeOutput;
  return cachedRuntime;
}

// ---------------------------------------------------------------------------
// Session reader
// ---------------------------------------------------------------------------

/**
 * Reads an Auth.js session from the incoming request.
 *
 * This is the primary entry point for the request-context adapter.
 * It lazily initializes the Auth.js runtime (if not already cached),
 * calls `auth(request)`, and returns the session or null.
 *
 * If the runtime is disabled or auth throws, returns null (fail-safe).
 *
 * @param request - Incoming HTTP request with cookies
 */
export async function readAuthjsSession(
  request: Request,
): Promise<AuthjsSessionLike | null> {
  try {
    const runtime = await getEnabledAuthjsRuntime();
    if (!runtime.auth) return null;
    return await runtime.auth(request);
  } catch {
    // Runtime disabled or auth threw — fail-safe to null
    return null;
  }
}

// ---------------------------------------------------------------------------
// Test reset
// ---------------------------------------------------------------------------

/**
 * Resets the cached runtime to null.
 *
 * **Test-only.** Used in test teardown to ensure isolation.
 */
export function resetAuthjsRuntimeForTests(): void {
  cachedRuntime = null;
}
