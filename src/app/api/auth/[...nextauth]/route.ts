/**
 * Auth.js Route Handler
 *
 * Next.js App Router catch-all route for Auth.js.
 * Gated behind ENABLE_AUTHJS_RUNTIME feature flag.
 *
 * When disabled (default): returns 501 (checked on every request).
 * When enabled: delegates to NextAuth route handlers (cached after first init).
 *
 * IMPORTANT: All infrastructure initialization (Prisma, adapter, NextAuth)
 * is deferred to request time to avoid build-time failures when
 * DATABASE_URL is not available.
 *
 * Kill switch semantics: the feature flag is checked BEFORE accessing
 * any cached enabled handlers. If the flag is disabled, the route
 * returns 501 immediately — even if enabled handlers were previously
 * cached in this process. Cached handlers remain in memory but are
 * never returned while the flag is disabled.
 *
 * TASK-0034: Route wiring only — no middleware, no request-context integration.
 * TASK-0034B: Fix kill switch — flag checked before cache on every request.
 */

import { NextRequest } from 'next/server';
import { isAuthjsRuntimeEnabled } from '@/lib/auth/authjs-feature-gate';
import {
  createAuthjsRouteHandlers,
  createDisabledAuthjsRouteResponse,
  type AuthjsRouteHandlerOutput,
} from '@/lib/auth/authjs-route-handlers';

// ---------------------------------------------------------------------------
// Lazy-initialized handlers — only enabled handlers are cached
// ---------------------------------------------------------------------------

let cachedEnabledHandlers: AuthjsRouteHandlerOutput | null = null;

/**
 * Returns cached enabled handlers, creating them lazily on first call.
 * MUST only be called after confirming isAuthjsRuntimeEnabled() is true.
 */
function getEnabledHandlers(): AuthjsRouteHandlerOutput {
  if (cachedEnabledHandlers) return cachedEnabledHandlers;

  // Lazy import to avoid build-time DATABASE_URL requirement
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getPrisma } = require('@/lib/prisma') as { getPrisma: () => import('@prisma/client').PrismaClient };

  cachedEnabledHandlers = createAuthjsRouteHandlers({
    prisma: getPrisma(),
    authSecret: process.env.AUTH_SECRET ?? '',
    providers: [],
    basePath: '/api/auth',
    debug: process.env.NODE_ENV === 'development',
  });

  return cachedEnabledHandlers;
}

// ---------------------------------------------------------------------------
// Route exports — flag checked BEFORE cache on every request
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthjsRuntimeEnabled()) {
    return createDisabledAuthjsRouteResponse();
  }

  return getEnabledHandlers().GET(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!isAuthjsRuntimeEnabled()) {
    return createDisabledAuthjsRouteResponse();
  }

  return getEnabledHandlers().POST(req);
}
