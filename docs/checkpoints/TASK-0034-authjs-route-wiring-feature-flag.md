# TASK-0034: Auth.js Route Wiring Behind Runtime Feature Flag

## Summary

Wired Auth.js Next.js route handler behind the existing strict runtime feature flag. When `ENABLE_AUTHJS_RUNTIME !== "true"`, the route returns 404 JSON. When enabled, it delegates to NextAuth with the Prisma adapter, JWT session strategy, and validated AUTH_SECRET. All infrastructure initialization is deferred to request time to avoid build-time failures.

## Files Created

- `src/lib/auth/authjs-prisma-db.ts` — Prisma-to-AuthjsAdapterDB bridge
- `src/lib/auth/authjs-route-handlers.ts` — route handler factory with feature gate
- `src/app/api/auth/[...nextauth]/route.ts` — Next.js catch-all auth route (lazy-initialized)
- `__tests__/auth/authjs-route-handlers.test.ts` — 25 tests covering bridge, factory, and scope guards
- `docs/checkpoints/TASK-0034-authjs-route-wiring-feature-flag.md` — this file

## Files Modified

- `src/lib/auth/index.ts` — added Prisma DB bridge and route handler exports
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
- When disabled: returns `{ enabled: false, GET: 404, POST: 404 }`
- When enabled: validates AUTH_SECRET, wires adapter, initializes NextAuth
- JWT session strategy enforced
- Providers injected (empty by default)
- Debug mode and base path configurable
- Uses strict feature flag (`ENABLE_AUTHJS_RUNTIME === "true"`)

## Route Handler

- `src/app/api/auth/[...nextauth]/route.ts`
- Lazy initialization pattern (deferred to first request)
- Avoids build-time `DATABASE_URL` requirement
- Uses `require('@/lib/prisma')` at request time
- Caches handlers after first initialization
- When disabled: 404 response without any Prisma or NextAuth initialization
- When enabled: full NextAuth handler chain

## Scope

- ✅ Auth route handler created
- ✅ Feature-gated (404 when disabled)
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

## Tests Added (25 tests)

### Prisma DB bridge tests (2 tests)

- Returns AuthjsAdapterDB from Prisma client
- Does not expose business or internal models

### Disabled state tests (6 tests)

- Returns `enabled: false` when flag is off
- GET returns 404 with error message
- POST returns 404 with error message
- Does not initialize NextAuth when disabled
- Disabled for "TRUE" (strict)
- Disabled for "1" (strict)

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
| `pnpm test` | ✅ 702 passed, 7 skipped |
| `pnpm build` | ✅ |

## Issues Found

Build initially failed because `getPrisma()` was called at module-level in the route file, crashing during Next.js page collection when `DATABASE_URL` is unavailable. Fixed by deferring all infrastructure initialization to request time via a lazy singleton pattern.

Previous task scope guards in TASK-0032 and TASK-0033 tests assumed no auth route existed. Updated to accommodate the new route while maintaining architectural isolation.

## Decision

Accepted feature-gated Auth.js route wiring boundary; real providers, middleware, and request-context integration remain deferred.

## Recommended Next Task

[Phase 3] TASK-0035: Configure first OAuth provider behind runtime feature flag
