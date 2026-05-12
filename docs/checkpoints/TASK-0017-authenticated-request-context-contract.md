# TASK-0017: Authenticated Request Context Contract

## Summary

Adds shared authenticated request context contract primitives and placeholder-safe resolver stubs for future API handlers. Defines typed context unions for anonymous, authenticated user, tenant-scoped, and system request flows. Provides pure constructors, type guards, assertion helpers, and a permission contract packaging helper. Resolver stubs return `AUTH_CONTEXT_UNAVAILABLE` (501) for all authenticated/tenant/system contexts, serving as safe placeholders until real auth integration is added.

## Files Created

- `src/app/api/_shared/request-context.ts` — request context contract
- `__tests__/api/api-request-context.test.ts` — 25 tests covering all contracts
- `docs/checkpoints/TASK-0017-authenticated-request-context-contract.md` — this checkpoint

## Files Modified

- `src/app/api/_shared/errors.ts` — added `AUTH_CONTEXT_UNAVAILABLE: 501` and `TENANT_CONTEXT_REQUIRED: 403`

## Context Types

| Type | Actor | Key Fields |
|---|---|---|
| `AnonymousRequestContext` | `anonymous` | userId=null, businessId=null, role=null |
| `AuthenticatedUserRequestContext` | `user` | userId=string, businessId=null, role=null |
| `TenantRequestContext` | `user` | userId, businessId, membershipId, role |
| `SystemRequestContext` | `system` | userId=null, businessId=string\|null, role=null |
| `ApiRequestContext` | union | discriminated union of all four |
| `ContextResult<T>` | — | `{ ok, context }` or `{ ok, response }` |

## Context Constructors

- `createAnonymousRequestContext(requestId?)` → `AnonymousRequestContext`
- `createAuthenticatedUserRequestContext({ requestId?, userId })` → `AuthenticatedUserRequestContext`
- `createTenantRequestContext({ requestId?, tenant: TenantContext })` → `TenantRequestContext`
- `createSystemRequestContext({ requestId?, businessId? }?)` → `SystemRequestContext`

## Type Guards

- `isAnonymousContext(ctx)` → true if `actorType === 'anonymous'`
- `isAuthenticatedContext(ctx)` → true if `actorType === 'user'`
- `isTenantContext(ctx)` → true if `actorType === 'user' && businessId !== null`
- `isSystemContext(ctx)` → true if `actorType === 'system'`

## Assertion Helpers

- `requireAuthenticatedContext(ctx)` → `ContextResult<AuthenticatedUser | Tenant>` (rejects with `UNAUTHENTICATED` 401)
- `requireTenantContext(ctx)` → `ContextResult<Tenant>` (rejects with `TENANT_CONTEXT_REQUIRED` 403)
- `requireSystemContext(ctx)` → `ContextResult<System>` (rejects with `ACCESS_DENIED` 403)

## Resolver Stubs

| Resolver | Returns |
|---|---|
| `resolveAnonymousRequestContext(req)` | Always succeeds with anonymous context + requestId |
| `resolveAuthenticatedRequestContext(req)` | Always fails: `AUTH_CONTEXT_UNAVAILABLE` 501 |
| `resolveTenantRequestContext(req)` | Always fails: `AUTH_CONTEXT_UNAVAILABLE` 501 |
| `resolveSystemRequestContext(req)` | Always fails: `AUTH_CONTEXT_UNAVAILABLE` 501 |

## Permission Contract Helper

- `RequiredPermissionContext` — packages `TenantRequestContext` + `AuthzPermission`
- `createRequiredPermissionContext(ctx, permission)` — pure packaging, no evaluation

## Error Map Updates

| Code | Status | Note |
|---|---|---|
| `AUTH_CONTEXT_UNAVAILABLE` | 501 | Added |
| `TENANT_CONTEXT_REQUIRED` | 403 | Added |
| `UNAUTHENTICATED` | 401 | Already existed |
| `ACCESS_DENIED` | 403 | Already existed |

## Tests Added

25 tests in `__tests__/api/api-request-context.test.ts`:

1. createAnonymousRequestContext creates anonymous context with null fields
2. createAnonymousRequestContext defaults requestId to null
3. createAuthenticatedUserRequestContext creates user context
4. createTenantRequestContext maps TenantContext correctly
5. createSystemRequestContext creates system context with optional businessId
6. isAnonymousContext returns true only for anonymous
7. isAuthenticatedContext returns true for authenticated user and tenant contexts
8. isTenantContext returns true only for tenant context
9. isSystemContext returns true only for system context
10. requireAuthenticatedContext accepts authenticated user context
11. requireAuthenticatedContext accepts tenant context
12. requireAuthenticatedContext rejects anonymous with UNAUTHENTICATED 401
13. requireTenantContext accepts tenant context
14. requireTenantContext rejects authenticated user context with TENANT_CONTEXT_REQUIRED 403
15. requireSystemContext accepts system context
16. requireSystemContext rejects user context with ACCESS_DENIED 403
17. createRequiredPermissionContext packages tenant context + permission
18. getRequestId reads x-request-id
19. resolveAnonymousRequestContext returns anonymous context and requestId
20. resolveAuthenticatedRequestContext returns AUTH_CONTEXT_UNAVAILABLE 501
21. resolveTenantRequestContext returns AUTH_CONTEXT_UNAVAILABLE 501
22. resolveSystemRequestContext returns AUTH_CONTEXT_UNAVAILABLE 501
23. getHttpStatusForError AUTH_CONTEXT_UNAVAILABLE returns 501
24. getHttpStatusForError TENANT_CONTEXT_REQUIRED returns 403
25. request-context.ts must not contain forbidden imports (scope guard)

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Pass |
| `pnpm prisma:format` | ✅ Pass |
| `pnpm prisma:generate` | ✅ Pass |
| `pnpm typecheck` | ✅ Pass (0 errors) |
| `pnpm lint` | ✅ Pass (0 errors, 0 warnings) |
| `pnpm test` | ✅ Pass (348 passed, 7 skipped) |
| `pnpm build` | ✅ Pass |

## Issues Found

None.

## Decision

Accepted authenticated request context contract.

## Scope Confirmation

- ✅ Request context contract only
- ✅ Resolver stubs only
- ✅ No real authentication
- ✅ No auth provider integration
- ✅ No middleware
- ✅ No route behavior changes
- ✅ No service calls
- ✅ No repository calls
- ✅ No getApiDependencies usage
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

## Recommended Next Task

[Phase 1] TASK-0018: Implement identity self-profile API handlers behind feature gate
