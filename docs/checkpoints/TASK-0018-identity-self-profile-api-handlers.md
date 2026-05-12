# TASK-0018: Identity Self-Profile API Handlers Behind Feature Gate

## Summary

Implements feature-gated identity self-profile handlers for `GET /api/identity/me` and `PATCH /api/identity/me`. Default behavior remains `NOT_IMPLEMENTED`; enabled behavior currently returns `AUTH_CONTEXT_UNAVAILABLE` until real authentication is integrated. Handler module uses dependency injection for testability and enforces context-first resolution before any service call.

## Files Created

- `src/app/api/identity/me/handler.ts` — Handler builders for GET/PATCH identity/me
- `__tests__/api/identity-me-handler.test.ts` — 15 tests covering handler behavior, route feature-gate, and scope guards
- `docs/checkpoints/TASK-0018-identity-self-profile-api-handlers.md` — This checkpoint

## Files Modified

- `src/app/api/identity/me/route.ts` — Updated from placeholder to feature-gated real handler wiring
- `__tests__/api/api-route-feature-gate.test.ts` — Updated identity/me tests to pass request parameter, updated enabled behavior expectations, updated scope guards
- `__tests__/api/api-composition-root.test.ts` — Updated identity/me route calls to pass request parameter
- `__tests__/api/api-handler-utilities.test.ts` — Updated identity/me route call and scope guard
- `__tests__/api/tenant-identity-route-skeletons.test.ts` — Updated identity/me route calls to pass request parameter

## Handler Design

Handler module exports three factory functions:

- `createGetIdentityMeHandler(deps)` — GET handler builder
- `createPatchIdentityMeHandler(deps)` — PATCH handler builder
- `createIdentityMeHandlers(deps)` — Combined factory returning `{ GET, PATCH }`

`IdentityMeHandlerDeps` contract:

```typescript
interface IdentityMeHandlerDeps {
  identityService: Pick<IdentityService, 'findUserById' | 'updateUser'>;
  resolveContext?: (request: Request) => Promise<ContextResult<AuthenticatedUserRequestContext>>;
}
```

Default resolver: `resolveAuthenticatedRequestContext` (placeholder stub returning AUTH_CONTEXT_UNAVAILABLE)

## Feature Gate Behavior

- `ENABLE_API_HANDLERS` missing or not `"true"`: returns `NOT_IMPLEMENTED` (501)
- `ENABLE_API_HANDLERS=true`: delegates to handler module
- `getApiDependencies()` is only called inside the enabled handler path (lazy)
- No module-level dependency initialization

## Context Behavior

- Context resolution happens before body validation (PATCH)
- Service is never called if context resolution fails
- Default resolver always returns `AUTH_CONTEXT_UNAVAILABLE` (501) until real auth is integrated

## Service Wiring

- Route handler lazily accesses `getApiDependencies().services.identity` inside the feature-gated path
- Only `findUserById` and `updateUser` methods are required via `Pick<IdentityService, ...>`
- No service calls when feature gate is disabled

## Route Changes

Route file changed from `createPlaceholderRoute` to explicit feature-gated functions:
- `export async function GET(request: Request)` — accepts request, checks gate, delegates to handler
- `export async function PATCH(request: Request)` — accepts request, checks gate, delegates to handler

## Tests Added

Handler module tests (8):
1. GET returns AUTH_CONTEXT_UNAVAILABLE when context fails
2. GET calls findUserById when context succeeds
3. GET passes service error through (USER_NOT_FOUND → 404)
4. PATCH returns AUTH_CONTEXT_UNAVAILABLE when context fails
5. PATCH validates body after context — rejects invalid body (400)
6. PATCH calls updateUser with userId and parsed body
7. PATCH passes service error through (IDENTITY_REPOSITORY_ERROR → 500)
8. createIdentityMeHandlers returns GET and PATCH functions

Route feature-gate tests (4):
9. GET returns NOT_IMPLEMENTED when ENABLE_API_HANDLERS missing
10. PATCH returns NOT_IMPLEMENTED when ENABLE_API_HANDLERS missing
11. GET returns AUTH_CONTEXT_UNAVAILABLE when ENABLE_API_HANDLERS=true
12. PATCH returns AUTH_CONTEXT_UNAVAILABLE when ENABLE_API_HANDLERS=true

Scope guard tests (3):
13. route.ts must not contain forbidden imports
14. handler.ts must not contain forbidden imports
15. Other route files remain placeholder-only and do not import handler module

## Checks Run

- `pnpm install` — ✅
- `pnpm prisma:format` — ✅
- `pnpm prisma:generate` — ✅
- `pnpm typecheck` — ✅
- `pnpm lint` — ✅
- `pnpm test` — ✅ (360 passed, 7 skipped)
- `pnpm build` — ✅

## Issues Found

Route-level enabled tests initially failed because `getApiDependencies()` triggered `getPrisma()` which fails without `DATABASE_URL` in test environment. Resolved by mocking `@/app/api/_shared/composition` in route test files. Handler-level tests continue to verify AUTH_CONTEXT_UNAVAILABLE behavior with injected dependencies (no mock needed).

## Decision

Accepted identity self-profile API handlers behind feature gate.

## Recommended Next Task

[Phase 1] TASK-0019: Implement authenticated request context resolver adapter

## Scope Confirmation

- ✅ Only identity/me route behavior changed
- ✅ Default behavior remains NOT_IMPLEMENTED
- ✅ Enabled behavior returns AUTH_CONTEXT_UNAVAILABLE until real auth exists
- ✅ Service calls occur only after successful context resolution
- ✅ No service calls when feature gate disabled
- ✅ No getApiDependencies call when feature gate disabled
- ✅ No getPrisma usage in route or handler files
- ✅ No PrismaClient usage in route or handler files
- ✅ No middleware
- ✅ No real authentication
- ✅ No auth provider integration
- ✅ No UI
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No new Prisma models
- ✅ No provider SDKs
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames
