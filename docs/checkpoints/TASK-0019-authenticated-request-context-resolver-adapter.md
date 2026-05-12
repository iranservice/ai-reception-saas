# TASK-0019: Authenticated Request Context Resolver Adapter

## Summary

Implements a placeholder-safe authenticated request context resolver adapter using an explicitly enabled development/test header contract. The adapter reads dev auth headers only when `ENABLE_DEV_AUTH_CONTEXT === "true"`. Default behavior remains `AUTH_CONTEXT_UNAVAILABLE`. No real authentication, middleware, or auth provider integration is added.

## Files Created

- `src/app/api/_shared/auth-context-adapter.ts` — Dev header auth context adapter
- `__tests__/api/api-auth-context-adapter.test.ts` — 30 tests covering adapter behavior
- `docs/checkpoints/TASK-0019-authenticated-request-context-resolver-adapter.md` — This checkpoint

## Files Modified

- `src/app/api/_shared/request-context.ts` — Resolver stubs now delegate to default adapter
- `src/app/api/_shared/errors.ts` — Added INVALID_AUTH_CONTEXT → 400

## Adapter Design

The adapter module exports:
- `DEV_AUTH_CONTEXT_FEATURE_FLAG` — env var name
- `DEV_AUTH_HEADERS` — header name mapping
- `areDevAuthHeadersEnabled(env?)` — strict "true" gate
- `readHeader(request, name)` — header reader with trim
- `authContextUnavailable(message?)` — 501 failure helper
- `invalidAuthContext(message)` — 400 failure helper
- `parseDevAuthenticatedPrincipal(request)` — parse x-dev-user-id
- `parseDevTenantPrincipal(request)` — parse tenant headers with role validation
- `parseDevSystemPrincipal(request)` — parse x-dev-system flag
- `createDevHeaderAuthContextAdapter(options?)` — factory with resolveAuthenticated/resolveTenant/resolveSystem
- `getDefaultAuthContextAdapter()` — returns dev header adapter

## Dev Header Contract

| Header | Required For | Purpose |
|---|---|---|
| x-dev-user-id | authenticated, tenant | User identifier |
| x-dev-business-id | tenant, system (optional) | Business identifier |
| x-dev-membership-id | tenant | Membership identifier |
| x-dev-role | tenant | Must be valid MembershipRoleValue |
| x-dev-system | system | Must be exactly "true" |

## Resolver Behavior

| Resolver | ENABLE_DEV_AUTH_CONTEXT missing | ENABLE_DEV_AUTH_CONTEXT=true |
|---|---|---|
| resolveAuthenticatedRequestContext | AUTH_CONTEXT_UNAVAILABLE 501 | Reads x-dev-user-id → authenticated context |
| resolveTenantRequestContext | AUTH_CONTEXT_UNAVAILABLE 501 | Reads tenant headers → tenant context |
| resolveSystemRequestContext | AUTH_CONTEXT_UNAVAILABLE 501 | Reads x-dev-system → system context |
| resolveAnonymousRequestContext | Always succeeds (unchanged) | Always succeeds (unchanged) |

## Identity/me Integration Behavior

With `ENABLE_API_HANDLERS=true` + `ENABLE_DEV_AUTH_CONTEXT=true`:
- GET /api/identity/me with x-dev-user-id calls identity service findUserById
- PATCH /api/identity/me with x-dev-user-id + valid body calls identity service updateUser
- Both verified with mocked composition (no DB)

## Error Map Updates

- Added `INVALID_AUTH_CONTEXT → 400` to errors.ts

## Tests Added

Env gate (3):
1. areDevAuthHeadersEnabled returns false when env missing
2. areDevAuthHeadersEnabled returns true only for exact "true"
3. areDevAuthHeadersEnabled returns false for "TRUE", "1", "yes", "on", ""

Header reading (2):
4. readHeader trims header values
5. readHeader returns null for missing or blank header

Helper results (2):
6. authContextUnavailable returns 501
7. invalidAuthContext returns 400

Principal parsers (7):
8. parseDevAuthenticatedPrincipal returns userId
9. parseDevAuthenticatedPrincipal returns AUTH_CONTEXT_UNAVAILABLE when missing
10. parseDevTenantPrincipal returns all fields
11. parseDevTenantPrincipal returns AUTH_CONTEXT_UNAVAILABLE when missing
12. parseDevTenantPrincipal returns INVALID_AUTH_CONTEXT for invalid role
13. parseDevSystemPrincipal returns system principal when "true"
14. parseDevSystemPrincipal with null businessId when omitted
15. parseDevSystemPrincipal returns AUTH_CONTEXT_UNAVAILABLE when missing

Adapter factory (4):
16. resolveAuthenticated returns AUTH_CONTEXT_UNAVAILABLE when disabled
17. resolveAuthenticated returns context when enabled
18. resolveTenant returns context when enabled
19. resolveSystem returns context when enabled

Default adapter (1):
20. getDefaultAuthContextAdapter returns valid adapter

Resolver integration — default (3):
21. resolveAuthenticatedRequestContext returns AUTH_CONTEXT_UNAVAILABLE by default
22. resolveTenantRequestContext returns AUTH_CONTEXT_UNAVAILABLE by default
23. resolveSystemRequestContext returns AUTH_CONTEXT_UNAVAILABLE by default

Resolver integration — enabled (3):
24. resolveAuthenticatedRequestContext returns context when enabled
25. resolveTenantRequestContext returns context when enabled
26. resolveSystemRequestContext returns context when enabled

Identity/me integration (2):
27. GET /api/identity/me calls mocked service with dev auth
28. PATCH /api/identity/me calls mocked updateUser with dev auth

Scope guards (2):
29. auth-context-adapter.ts must not contain forbidden imports
30. request-context.ts must not contain forbidden imports

Total: 30 new tests

## Checks Run

- `pnpm install` — ✅
- `pnpm prisma:format` — ✅
- `pnpm prisma:generate` — ✅
- `pnpm typecheck` — ✅
- `pnpm lint` — ✅
- `pnpm test` — ✅ (390 passed, 7 skipped)
- `pnpm build` — ✅

## Issues Found

TypeScript required using `Record<string, string | undefined>` instead of `NodeJS.ProcessEnv` for the env parameter to avoid requiring `NODE_ENV` in test mocks. This matches the existing pattern used in `feature-gate.ts`.

## Decision

Accepted authenticated request context resolver adapter.

## Recommended Next Task

[Phase 1] TASK-0020: Implement identity session API handler contracts behind feature gate

## Scope Confirmation

- ✅ Dev/test auth context adapter only
- ✅ No real authentication
- ✅ No auth provider integration
- ✅ No middleware
- ✅ No token verification
- ✅ No session cookie parsing
- ✅ No service calls inside auth adapter
- ✅ No repository calls inside auth adapter
- ✅ No getApiDependencies inside auth adapter
- ✅ No getPrisma usage
- ✅ No PrismaClient usage
- ✅ No UI
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No new Prisma models
- ✅ No provider SDKs
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames
