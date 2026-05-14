/**
 * Auth.js Route Handler
 *
 * Next.js App Router catch-all route for Auth.js.
 * Gated behind ENABLE_AUTHJS_RUNTIME feature flag.
 *
 * When disabled (default): returns 404.
 * When enabled: delegates to NextAuth route handlers.
 *
 * IMPORTANT: All infrastructure initialization (Prisma, adapter, NextAuth)
 * is deferred to request time to avoid build-time failures when
 * DATABASE_URL is not available.
 *
 * TASK-0034: Route wiring only — no middleware, no request-context integration.
 */

import { NextRequest } from 'next/server';
import { isAuthjsRuntimeEnabled } from '@/lib/auth/authjs-feature-gate';
import {
  createAuthjsRouteHandlers,
  AUTHJS_ROUTE_DISABLED_MESSAGE,
  AUTHJS_ROUTE_DISABLED_STATUS,
} from '@/lib/auth/authjs-route-handlers';

// ---------------------------------------------------------------------------
// Lazy-initialized handlers — deferred to first request
// ---------------------------------------------------------------------------

let cachedHandlers: ReturnType<typeof createAuthjsRouteHandlers> | null = null;

function getHandlers(): ReturnType<typeof createAuthjsRouteHandlers> {
  if (cachedHandlers) return cachedHandlers;

  if (!isAuthjsRuntimeEnabled()) {
    cachedHandlers = {
      enabled: false,
      GET: async () =>
        new Response(
          JSON.stringify({ error: AUTHJS_ROUTE_DISABLED_MESSAGE }),
          { status: AUTHJS_ROUTE_DISABLED_STATUS, headers: { 'Content-Type': 'application/json' } },
        ),
      POST: async () =>
        new Response(
          JSON.stringify({ error: AUTHJS_ROUTE_DISABLED_MESSAGE }),
          { status: AUTHJS_ROUTE_DISABLED_STATUS, headers: { 'Content-Type': 'application/json' } },
        ),
    };
    return cachedHandlers;
  }

  // Lazy import to avoid build-time DATABASE_URL requirement
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getPrisma } = require('@/lib/prisma') as { getPrisma: () => import('@prisma/client').PrismaClient };

  cachedHandlers = createAuthjsRouteHandlers({
    prisma: getPrisma(),
    authSecret: process.env.AUTH_SECRET ?? '',
    providers: [],
    basePath: '/api/auth',
    debug: process.env.NODE_ENV === 'development',
  });

  return cachedHandlers;
}

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<Response> {
  return getHandlers().GET(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return getHandlers().POST(req);
}
