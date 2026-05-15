/**
 * Auth.js Route Handler
 *
 * Next.js App Router catch-all route for Auth.js.
 * Gated behind ENABLE_AUTHJS_RUNTIME feature flag.
 *
 * When disabled (default): returns 501 (checked on every request).
 * When enabled: delegates to the shared Auth.js lazy runtime.
 *
 * IMPORTANT: All infrastructure initialization (Prisma, adapter, NextAuth)
 * is deferred to request time via the shared runtime to avoid build-time
 * failures when DATABASE_URL is not available.
 *
 * Kill switch semantics: the feature flag is checked BEFORE accessing
 * the shared runtime. If the flag is disabled, the route returns 501
 * immediately — even if an enabled runtime was previously cached.
 *
 * TASK-0034: Route wiring only — no middleware, no request-context integration.
 * TASK-0034B: Fix kill switch — flag checked before cache on every request.
 * TASK-0036: Wire Google provider behind ENABLE_AUTHJS_GOOGLE_PROVIDER flag.
 * TASK-0039: Delegate to shared lazy runtime (authjs-runtime.ts).
 */

import { NextRequest } from 'next/server';
import { isAuthjsRuntimeEnabled } from '@/lib/auth/authjs-feature-gate';
import { createDisabledAuthjsRouteResponse } from '@/lib/auth/authjs-route-handlers';
import { getEnabledAuthjsRuntime } from '@/lib/auth/authjs-runtime';

// ---------------------------------------------------------------------------
// Route exports — flag checked BEFORE runtime on every request
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthjsRuntimeEnabled()) {
    return createDisabledAuthjsRouteResponse();
  }

  return (await getEnabledAuthjsRuntime()).GET(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!isAuthjsRuntimeEnabled()) {
    return createDisabledAuthjsRouteResponse();
  }

  return (await getEnabledAuthjsRuntime()).POST(req);
}
