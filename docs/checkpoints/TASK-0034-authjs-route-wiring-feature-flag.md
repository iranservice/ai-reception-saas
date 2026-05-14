# TASK-0034: Auth.js Route Wiring Behind Runtime Feature Flag

## Summary

Wired Auth.js Next.js route handler behind the existing strict runtime feature flag. When `ENABLE_AUTHJS_RUNTIME !== "true"`, the route returns 501 JSON with structured error body. When enabled, it delegates to NextAuth with the Prisma adapter, JWT session strategy, and validated AUTH_SECRET. All infrastructure initialization is deferred to request time to avoid build-time failures. Disabled state is never cached; only enabled handlers are cached.

## Files Created

- `src/lib/auth/authjs-prisma-db.ts` — Prisma-to-AuthjsAdapterDB bridge
- `src/lib/auth/authjs-route-handlers.ts` — route handler factory with feature gate and shared disabled response helper
- `src/app/api/auth/[...nextauth]/route.ts` — Next.js catch-all auth route (lazy-initialized, disabled state never cached)
- `__tests__/auth/authjs-route-handlers.test.ts` — 28 tests covering bridge, factory, disabled response helper, and scope guards
- `docs/checkpoints/TASK-0034-authjs-route-wiring-feature-flag.md` — this file

## Files Modified

- `src/lib/auth/index.ts` — added Prisma DB bridge, route handler, and disabled response helper exports
- `__tests__/auth/authjs-adapter.test.ts` — updated scope guard for route existence
- `__tests__/auth/authjs-runtime-config.test.ts` — updated scope guards for route existence

## Prisma DB Bridge

- `createAuthjsAdapterDb(prisma)` — creates `AuthjsAdapterDB` from Prisma client
- Exposes only: `user`, `account`, `verificationToken`
- Does not expose: business, businessMembership, auditEvent, internal session
- Does not import `PrismaClient` or `getPrisma`
- No database call at import time

## Route Handler Factory

- `createAuthjsRouteHandlers(input)` — creates gated GET/POST handlers
- When disabled: returns `{ enabled: false, GET: 501, POST: 501 }`
- When enabled: validates AUTH_SECRET, wires adapter, initializes NextAuth
- JWT session strategy enforced
- Providers injected (empty by default)
- Debug mode and base path configurable
- Uses strict feature flag (`ENABLE_AUTHJS_RUNTIME === "true"`)

## Disabled Response Contract

- Status: `501`
- Body:
  ```json
  {
    "ok": false,
    "error": {
      "code": "AUTHJS_RUNTIME_DISABLED",
      "message": "Auth.js runtime is disabled."
    }
  }
  ```
- Single source of truth: `createDisabledAuthjsRouteResponse()`
- No duplicate disabled response construction between factory and route

## Route Handler

- `src/app/api/auth/[...nextauth]/route.ts`
- Lazy initialization pattern (deferred to first request)
- Avoids build-time `DATABASE_URL` requirement
- Uses `require('@/lib/prisma')` at request time
- Caches only enabled handlers after first initialization
- Disabled state is never cached — re-checks feature flag on every request
- Uses shared `createDisabledAuthjsRouteResponse()` helper
- When disabled: 501 response without any Prisma or NextAuth initialization
- When enabled: full NextAuth handler chain

## Scope

- ✅ Auth route handler created
- ✅ Feature-gated (501 when disabled)
- ✅ Disabled state never cached
- ✅ Single disabled response helper
- ✅ No middleware
- ✅ No real OAuth providers
- ✅ No provider secrets
- ✅ No `.env` or `.env.example` changes
- ✅ No login/signup UI
- ✅ No request-context resolver integration
- ✅ No domain service changes
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No existing API route changes
- ✅ No database session model
- ✅ Internal Session unchanged
- ✅ Build passes without DATABASE_URL

## Tests (28 tests)

### Prisma DB bridge tests (2 tests)

- Returns AuthjsAdapterDB from Prisma client
- Does not expose business or other internal models

### Disabled state tests (6 tests)

- Returns `enabled: false` when flag is off
- GET returns 501 with structured error body
- POST returns 501 with structured error body
- Does not initialize NextAuth when disabled
- Disabled for "TRUE" (strict)
- Disabled for "1" (strict)

### createDisabledAuthjsRouteResponse tests (3 tests)

- Returns 501 status
- Returns structured error body (`ok: false`, `error.code`, `error.message`)
- Returns application/json content-type

### Enabled state tests (8 tests)

- Returns `enabled: true` when flag is on
- Throws on empty AUTH_SECRET
- Throws on whitespace-only AUTH_SECRET
- Initializes NextAuth with correct config (session, secret, basePath, debug, adapter, providers)
- Defaults debug to false
- Defaults providers to empty array
- Returns real NextAuth GET handler
- Returns real NextAuth POST handler

### Scope guard tests (9 tests)

- No middleware.ts added
- Auth route handler exists at correct path
- Auth route handler does not import request-context resolver
- Existing tenant/identity API routes not modified
- src/domains/** does not import route handlers
- prisma/schema.prisma not changed
- No migration files added
- Route handler module does not import getPrisma directly
- Prisma-db bridge does not import @prisma/client or getPrisma

## Checks Run

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 4 warnings) |
| `pnpm test` | ✅ 705 passed, 7 skipped |
| `pnpm build` | ✅ |

## Issues Found and Resolved

1. Build initially failed because `getPrisma()` was called at module-level in the route file. Fixed by deferring to request time via lazy singleton.
2. CTO review: disabled response was 404 with flat body. Fixed to 501 with structured `{ ok, error: { code, message } }` body.
3. CTO review: disabled handlers were cached, preventing re-activation. Fixed: only enabled handlers are cached; disabled state re-checks on every request.
4. CTO review: disabled response was duplicated between factory and route. Fixed: single exported `createDisabledAuthjsRouteResponse()` used everywhere.
5. Previous task scope guards updated to accommodate new route while maintaining architectural isolation.

## Decision

Accepted Auth.js route wiring behind runtime feature flag; runtime remains disabled by default and provider/request-context integration remains deferred.

## Recommended Next Task

[Phase 2] TASK-0035: Auth.js provider configuration design and environment contract
