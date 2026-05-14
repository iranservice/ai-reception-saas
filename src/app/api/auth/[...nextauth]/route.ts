/**
 * Auth.js Route Handler
 *
 * Next.js App Router catch-all route for Auth.js.
 * Gated behind ENABLE_AUTHJS_RUNTIME feature flag.
 *
 * When disabled (default): returns 501 (re-checked on every request).
 * When enabled: delegates to NextAuth route handlers (cached after first init).
 *
 * IMPORTANT: All infrastructure initialization (Prisma, adapter, NextAuth)
 * is deferred to request time to avoid build-time failures when
 * DATABASE_URL is not available.
 *
 * Disabled state is never cached — if the feature flag changes,
 * the next request will re-evaluate. Only enabled handlers are cached.
 *
 * TASK-0034: Route wiring only — no middleware, no request-context integration.
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

function getHandlers(): AuthjsRouteHandlerOutput | null {
  if (cachedEnabledHandlers) return cachedEnabledHandlers;

  if (!isAuthjsRuntimeEnabled()) {
    // Do NOT cache disabled state — re-check on every request
    return null;
  }

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
// Route exports
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<Response> {
  const handlers = getHandlers();
  if (!handlers) return createDisabledAuthjsRouteResponse();
  return handlers.GET(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  const handlers = getHandlers();
  if (!handlers) return createDisabledAuthjsRouteResponse();
  return handlers.POST(req);
}
