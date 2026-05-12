# TASK-0020: Identity Session API Handler Contracts Behind Feature Gate

## Summary

Implements feature-gated identity session API handler contracts for `POST /api/identity/sessions`, `GET /api/identity/sessions`, and `POST /api/identity/sessions/:sessionId/revoke`. Default behavior remains `NOT_IMPLEMENTED`. Enabled behavior returns `AUTH_CONTEXT_UNAVAILABLE` until dev auth is enabled. Session creation uses context userId (not client body), and session revocation enforces ownership checks.

## Files Created

- `src/app/api/identity/sessions/handler.ts` — Session handler builders (POST, GET, REVOKE)
- `__tests__/api/identity-sessions-handler.test.ts` — 26 tests covering handlers, routes, and scope guards
- `docs/checkpoints/TASK-0020-identity-session-api-handler-contracts.md` — This checkpoint

## Files Modified

- `src/app/api/identity/sessions/route.ts` — Replaced placeholder with feature-gated POST/GET wiring
- `src/app/api/identity/sessions/[sessionId]/revoke/route.ts` — Replaced placeholder with feature-gated POST revoke wiring
- `__tests__/api/api-route-feature-gate.test.ts` — Removed session routes from PLACEHOLDER_ROUTE_FILES list
- `__tests__/api/identity-me-handler.test.ts` — Removed session routes from OTHER_ROUTE_FILES scope guard
- `__tests__/api/tenant-identity-route-skeletons.test.ts` — Added composition mock, pass Request objects to session route calls

## Handler Design

Handler module exports four factory functions:

- `createPostIdentitySessionsHandler(deps)` — POST handler builder
- `createGetIdentitySessionsHandler(deps)` — GET handler builder
- `createPostRevokeIdentitySessionHandler(deps)` — REVOKE handler builder
- `createIdentitySessionHandlers(deps)` — Combined factory

`IdentitySessionsHandlerDeps` contract:

```typescript
interface IdentitySessionsHandlerDeps {
  identityService: Pick<IdentityService, 'createSession' | 'listUserSessions' | 'findSessionById' | 'revokeSession'>;
  resolveContext?: (request: Request) => Promise<ContextResult<AuthenticatedUserRequestContext>>;
  now?: () => Date;
}
```

## Feature Gate Behavior

| Condition | POST sessions | GET sessions | POST revoke |
|---|---|---|---|
| `ENABLE_API_HANDLERS` missing | 501 NOT_IMPLEMENTED | 501 NOT_IMPLEMENTED | 501 NOT_IMPLEMENTED |
| `ENABLE_API_HANDLERS=true` (no dev auth) | 501 AUTH_CONTEXT_UNAVAILABLE | 501 AUTH_CONTEXT_UNAVAILABLE | 501 AUTH_CONTEXT_UNAVAILABLE |
| Both enabled + dev headers | Service result | Service result | Service result |

## Context Behavior

- Context resolution happens before body/param validation
- Service is never called if context resolution fails
- userId always comes from authenticated context, never from client body

## Session Creation Behavior

1. Resolve authenticated context
2. Validate body against `createSessionInputSchema.omit({ userId: true }).strict()`
3. Call `createSession({ ...body, userId: context.userId })`
4. userId injected from context — body userId is rejected by strict schema

## Session Listing Behavior

1. Resolve authenticated context
2. Parse `includeRevoked` boolean query param
3. Call `listUserSessions({ userId: context.userId, includeRevoked })`

## Session Revocation Behavior

1. Resolve authenticated context
2. Validate `sessionId` route param (UUID)
3. Call `findSessionById({ sessionId })`
4. If session not found → 404 SESSION_NOT_FOUND
5. If `session.userId !== context.userId` → 403 ACCESS_DENIED
6. Call `revokeSession({ sessionId, revokedAt: now().toISOString() })`

## Route Changes

### POST/GET /api/identity/sessions

Replaced `createPlaceholderRoute` with explicit feature-gated functions accepting `Request` parameter. Uses lazy `getApiDependencies()` inside enabled branch.

### POST /api/identity/sessions/:sessionId/revoke

Replaced `createPlaceholderRoute` with feature-gated function accepting `Request` and `RevokeRouteContext`. Uses `Promise<{ sessionId: string }>` params type for Next.js 15 App Router compatibility. Route params resolved only after feature gate check.

## Tests Added

Handler module (13):
1. POST returns AUTH_CONTEXT_UNAVAILABLE when context fails
2. POST rejects invalid body after context succeeds
3. POST creates session using context userId, not body userId
4. POST passes service error through
5. GET returns AUTH_CONTEXT_UNAVAILABLE when context fails
6. GET lists sessions for context userId
7. GET parses includeRevoked=true
8. REVOKE returns AUTH_CONTEXT_UNAVAILABLE when context fails
9. REVOKE rejects invalid sessionId param
10. REVOKE returns SESSION_NOT_FOUND when findSessionById returns ok(null)
11. REVOKE returns ACCESS_DENIED when session.userId does not match context
12. REVOKE revokes owned session with fixed now()
13. createIdentitySessionHandlers returns POST, GET, REVOKE

Route feature-gate disabled (3):
14. POST sessions returns NOT_IMPLEMENTED
15. GET sessions returns NOT_IMPLEMENTED
16. POST revoke returns NOT_IMPLEMENTED

Route feature-gate enabled without dev auth (3):
17. POST sessions returns AUTH_CONTEXT_UNAVAILABLE
18. GET sessions returns AUTH_CONTEXT_UNAVAILABLE
19. POST revoke returns AUTH_CONTEXT_UNAVAILABLE

Route feature-gate enabled with dev auth (3):
20. POST sessions returns ok from mocked createSession
21. GET sessions returns ok from mocked listUserSessions
22. POST revoke returns ok from mocked revokeSession

Scope guards (4):
23. sessions route.ts must not contain forbidden imports
24. revoke route.ts must not contain forbidden imports
25. handler.ts must not contain forbidden imports (including getApiDependencies)
26. non-session placeholder routes remain unchanged

Total: 26 new tests

## Checks Run

- `pnpm install` — ✅
- `pnpm prisma:format` — ✅
- `pnpm prisma:generate` — ✅
- `pnpm typecheck` — ✅
- `pnpm lint` — ✅
- `pnpm test` — ✅ (412 passed, 7 skipped)
- `pnpm build` — ✅

## Issues Found

1. Revoke route import path needed `../../handler` (2 directories up from `[sessionId]/revoke/`)
2. Next.js 15 App Router requires `Promise<params>` type (not union with sync params)
3. Session routes removed from placeholder lists in existing scope guard tests

## Decision

Accepted identity session API handler contracts behind feature gate.

## Recommended Next Task

[Phase 1] TASK-0021: Implement business workspace API handler contracts behind feature gate

## Scope Confirmation

- ✅ Only identity session routes changed
- ✅ Default behavior remains NOT_IMPLEMENTED
- ✅ Enabled behavior returns AUTH_CONTEXT_UNAVAILABLE until dev auth is enabled
- ✅ Dev auth mode can call mocked identity session services
- ✅ Service calls occur only after successful context resolution
- ✅ No service calls when feature gate disabled
- ✅ No getApiDependencies call when feature gate disabled
- ✅ No getPrisma usage in route or handler files
- ✅ No PrismaClient usage in route or handler files
- ✅ No middleware
- ✅ No real authentication
- ✅ No token verification
- ✅ No session cookie parsing
- ✅ No auth provider integration
- ✅ No UI
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No new Prisma models
- ✅ No provider SDKs
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames
