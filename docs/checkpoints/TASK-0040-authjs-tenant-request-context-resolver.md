# TASK-0040 — Auth.js Tenant Request-Context Resolver With Explicit Business Scope

| Field | Value |
|---|---|
| Task ID | TASK-0040 |
| Title | Implement Auth.js tenant request-context resolver with explicit business scope |
| Status | Complete |
| Branch | task-0040-authjs-tenant-request-context-resolver |
| Baseline | PR #44 merged (6c1c294) |
| Scope | Source code + tests + documentation |

## Summary

Extends the Auth.js request-context adapter (TASK-0039) from authenticated-only to tenant-scoped context with explicit business scope support. Business-scoped route handlers pass the route-param `businessId` as explicit scope into the tenant resolver. The `x-business-id` header serves only as a fallback for generic tenant-scoped routes that lack a businessId route parameter. When scope source is `route-param`, the resolver never falls back to the header. System context resolution remains explicitly deferred.

## Architecture

```
resolveTenant(request, scope?)
  ├── resolveAuthenticated(request)       → userId from session
  ├── resolveBusinessId(request, scope)
  │   ├── scope.source === 'route-param'  → scope.businessId only (no fallback)
  │   ├── scope.businessId (other source) → use if non-blank
  │   └── x-business-id header            → fallback when no usable scope
  └── tenantMembershipResolver(userId, businessId)
        └── (lazy import) composition.ts → TenancyService.resolveTenantContext
```

Business-scoped route handlers (businesses, memberships, audit-events):
1. Parse route params first to extract `businessId`
2. Pass `{ businessId, source: 'route-param' }` as scope to `resolveTenant`
3. Header is never consulted — route-param is the sole source

Generic tenant routes (authz evaluate/require):
1. No explicit scope
2. Falls back to `x-business-id` header

## Error Contract

| Condition | Code | Status |
|---|---|---|
| `ENABLE_AUTHJS_REQUEST_CONTEXT` disabled | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| `ENABLE_AUTHJS_RUNTIME` disabled | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| `auth(request)` throws | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| `auth(request)` returns null | `UNAUTHENTICATED` | 401 |
| `session.user` missing | `UNAUTHENTICATED` | 401 |
| `session.user.id` missing/empty/whitespace | `INVALID_AUTH_CONTEXT` | 400 |
| Route-param scope with blank/missing businessId | `TENANT_CONTEXT_REQUIRED` | 403 |
| No scope and no `x-business-id` header | `TENANT_CONTEXT_REQUIRED` | 403 |
| No scope and empty/whitespace `x-business-id` | `TENANT_CONTEXT_REQUIRED` | 403 |
| Membership not found | `ACCESS_DENIED` | 403 |
| Membership resolver throws | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| Valid tenant context | Success | — |
| System resolver | `AUTH_CONTEXT_UNAVAILABLE` | 501 |

## Files Modified

| File | Change |
|---|---|
| `src/app/api/_shared/request-context.ts` | Added `TenantRequestScope` type; updated `resolveTenantRequestContext(request, scope?)` |
| `src/app/api/_shared/auth-context-adapter.ts` | Updated `AuthContextAdapter.resolveTenant(request, scope?)`; dev header adapter accepts scope |
| `src/app/api/_shared/authjs-context-adapter.ts` | `resolveTenant(request, scope?)` with `normalizeBusinessId` and `resolveBusinessId` helpers; route-param scope never falls back to header |
| `src/app/api/businesses/handler.ts` | GET_BY_ID and PATCH_BY_ID: parse params first, pass scope `{ businessId, source: 'route-param' }` |
| `src/app/api/businesses/[businessId]/memberships/handler.ts` | All 5 handlers: parse params first, pass explicit scope |
| `src/app/api/businesses/[businessId]/audit-events/handler.ts` | Both handlers: parse params first, pass explicit scope |
| `src/app/api/authz/handler.ts` | Deps type updated for scope; call sites unchanged (no route-param businessId) |
| `__tests__/api/authjs-request-context-adapter.test.ts` | Route-param isolation tests, header fallback tests, whitespace tests |
| `__tests__/api/businesses-handler.test.ts` | Scope-passing verification tests |

## Files Not Changed

- package.json / pnpm-lock.yaml
- prisma/schema.prisma / prisma/migrations/*
- env files
- middleware
- UI
- domain services / repository layer

## Design Decisions

1. **Route-param isolation**: When `scope.source === 'route-param'`, the adapter uses only `scope.businessId`. If it is blank/missing, returns 403 immediately — never falls back to `x-business-id` header.
2. **normalizeBusinessId helper**: Trims and returns null for empty/whitespace values. Unified normalization for both scope and header.
3. **resolveBusinessId helper**: Encapsulates the priority logic (route-param only → scope → header fallback).
4. **Parse params first**: Business-scoped handlers parse route params before calling `resolveTenant`, so the scope is available at resolution time.
5. **Kept assertBusinessRouteMatchesTenant**: Defense-in-depth guard remains even though scope ensures correctness.
6. **Generic routes unaffected**: Authz evaluate/require handlers continue to use header-only resolution with no scope.
7. **Consistent 403 for missing scope**: Empty/whitespace values from any source return `TENANT_CONTEXT_REQUIRED` 403 (not 400).

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 8 warnings) |
| `pnpm test` | ✅ 829 passed, 7 skipped |
| `pnpm build` | ✅ |

## Decision

Accepted Auth.js tenant request-context resolver with explicit business scope; system context, middleware, tenant picker, and production rollout remain deferred.

## Recommended Next Task

[Phase 2] TASK-0041: Add Auth.js request-context integration smoke tests for protected API handlers
