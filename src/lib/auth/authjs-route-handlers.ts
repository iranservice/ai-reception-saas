/**
 * Auth.js Route Handler Factory
 *
 * Creates Next.js App Router route handlers (GET/POST) for Auth.js,
 * gated behind the runtime feature flag.
 *
 * When `ENABLE_AUTHJS_RUNTIME !== "true"`, the handlers return a
 * 501 JSON response indicating the runtime is disabled.
 *
 * Design decisions:
 * - Feature-gated: route returns 501 when disabled
 * - JWT session strategy enforced
 * - Adapter is wired through createAuthjsAdapter + createAuthjsAdapterDb
 * - No real providers configured (empty array by default)
 * - No middleware
 * - No request-context integration
 * - AUTH_SECRET validated at initialization time
 *
 * @module
 */

import NextAuth from 'next-auth';
import type { NextAuthResult } from 'next-auth';
import type { NextRequest } from 'next/server';
import { isAuthjsRuntimeEnabled } from './authjs-feature-gate';
import { createAuthjsAdapter } from './authjs-adapter';
import { createAuthjsAdapterDb, type AuthjsPrismaClient } from './authjs-prisma-db';
import { validateAuthjsSecret, AUTHJS_SESSION_STRATEGY } from './authjs-runtime-config';
import { setAuthjsAuth } from './authjs-runtime';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTHJS_ROUTE_DISABLED_CODE =
  'AUTHJS_RUNTIME_DISABLED' as const;

export const AUTHJS_ROUTE_DISABLED_MESSAGE =
  'Auth.js runtime is disabled.' as const;

export const AUTHJS_ROUTE_DISABLED_STATUS = 501 as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input to the route handler factory.
 */
export interface AuthjsRouteHandlerInput {
  /** Prisma-like client for adapter wiring */
  prisma: AuthjsPrismaClient;
  /** AUTH_SECRET for JWT signing */
  authSecret: string;
  /** Auth.js providers (opaque config objects; empty by default) */
  providers?: unknown[];
  /** Base path for auth routes */
  basePath?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Output from the route handler factory.
 */
export interface AuthjsRouteHandlerOutput {
  /** Whether Auth.js runtime was enabled at creation time */
  enabled: boolean;
  /** GET handler for [...nextauth] route */
  GET: (req: NextRequest) => Promise<Response>;
  /** POST handler for [...nextauth] route */
  POST: (req: NextRequest) => Promise<Response>;
  /** Auth.js session reader — null when disabled */
  auth: ((...args: unknown[]) => unknown) | null;
}

// ---------------------------------------------------------------------------
// Disabled response helper (single source of truth)
// ---------------------------------------------------------------------------

/**
 * Creates a 501 JSON response when Auth.js runtime is disabled.
 *
 * Response body:
 * ```json
 * {
 *   "ok": false,
 *   "error": {
 *     "code": "AUTHJS_RUNTIME_DISABLED",
 *     "message": "Auth.js runtime is disabled."
 *   }
 * }
 * ```
 *
 * Exported so that route.ts can use the same response shape
 * without duplicating construction logic.
 */
export function createDisabledAuthjsRouteResponse(): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: AUTHJS_ROUTE_DISABLED_CODE,
        message: AUTHJS_ROUTE_DISABLED_MESSAGE,
      },
    }),
    {
      status: AUTHJS_ROUTE_DISABLED_STATUS,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

// ---------------------------------------------------------------------------
// Route handler factory
// ---------------------------------------------------------------------------

/**
 * Creates Auth.js route handlers gated behind the feature flag.
 *
 * When `ENABLE_AUTHJS_RUNTIME === "true"`:
 * - Validates AUTH_SECRET
 * - Wires adapter via Prisma bridge
 * - Initializes NextAuth with JWT strategy
 * - Returns real GET/POST handlers
 *
 * When disabled:
 * - Returns 501 handlers (no Auth.js initialization)
 *
 * @param input - Route handler configuration
 */
export function createAuthjsRouteHandlers(
  input: AuthjsRouteHandlerInput,
): AuthjsRouteHandlerOutput {
  if (!isAuthjsRuntimeEnabled()) {
    return {
      enabled: false,
      GET: async () => createDisabledAuthjsRouteResponse(),
      POST: async () => createDisabledAuthjsRouteResponse(),
      auth: null,
    };
  }

  // Validate secret before initializing NextAuth
  const secret = validateAuthjsSecret(input.authSecret);

  // Wire adapter: Prisma → AdapterDB → Adapter
  const adapterDb = createAuthjsAdapterDb(input.prisma);
  const adapter = createAuthjsAdapter(adapterDb);

  // Initialize NextAuth
  const nextAuth: NextAuthResult = NextAuth({
    adapter,
    providers: (input.providers ?? []) as never[],
    session: { strategy: AUTHJS_SESSION_STRATEGY },
    secret,
    basePath: input.basePath,
    debug: input.debug ?? false,
  });

  // Register auth for request-context adapter access
  setAuthjsAuth(nextAuth.auth);

  return {
    enabled: true,
    GET: nextAuth.handlers.GET,
    POST: nextAuth.handlers.POST,
    auth: nextAuth.auth,
  };
}
