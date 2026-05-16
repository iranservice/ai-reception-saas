# TASK-0040 — Auth.js Tenant Request-Context Resolver

| Field | Value |
|---|---|
| Task ID | TASK-0040 |
| Title | Implement Auth.js tenant request-context resolver with explicit business scope |
| Status | Complete |
| Branch | task-0040-authjs-tenant-request-context-resolver |
| Baseline | PR #44 merged (6c1c294) |
| Scope | Source code + tests + documentation |

## Summary

Extends the Auth.js request-context adapter (TASK-0039) from authenticated-only to tenant-scoped context. When `ENABLE_AUTHJS_REQUEST_CONTEXT` is enabled, `resolveTenant` extracts a business scope from the `x-business-id` header, authenticates the user via Auth.js session, then resolves tenant membership through the composition root's TenancyService. System context resolution remains explicitly deferred.

## Architecture

```
resolveTenant(request)
  ├── resolveAuthenticated(request)  → userId from session
  ├── x-business-id header           → businessId
  └── tenantMembershipResolver(userId, businessId)
        └── (lazy import) composition.ts → TenancyService.resolveTenantContext
              └── TenancyRepository.resolveTenantContext
```

The tenant membership resolver is injected via `AuthjsRequestContextAdapterOptions.tenantMembershipResolver`. The default adapter wires it lazily from the composition root, avoiding module-level imports of Prisma/repository dependencies.

## Error Contract

| Condition | Code | Status |
|---|---|---|
| `ENABLE_AUTHJS_REQUEST_CONTEXT` disabled | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| `ENABLE_AUTHJS_RUNTIME` disabled | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| `auth(request)` throws | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| `auth(request)` returns null | `UNAUTHENTICATED` | 401 |
| `session.user` missing | `UNAUTHENTICATED` | 401 |
| `session.user.id` missing/empty/whitespace | `INVALID_AUTH_CONTEXT` | 400 |
| No `x-business-id` header | `TENANT_CONTEXT_REQUIRED` | 403 |
| Empty/whitespace `x-business-id` | `INVALID_AUTH_CONTEXT` | 400 |
| Membership not found | `ACCESS_DENIED` | 403 |
| Membership resolver throws | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| Valid tenant context | Success | — |
| System resolver | `AUTH_CONTEXT_UNAVAILABLE` | 501 |

## Files Modified

| File | Change |
|---|---|
| `src/app/api/_shared/authjs-context-adapter.ts` | Implemented `resolveTenant`; added `TenantMembershipResolver` type; added `x-business-id` extraction; lazy composition root wiring in default adapter |
| `__tests__/api/authjs-request-context-adapter.test.ts` | Replaced 2 tenant stub tests with 10 comprehensive tenant resolution tests covering flag gates, auth propagation, missing/empty business scope, membership errors, resolver throws, happy path, trimming, and auth call verification |

## Files Not Changed

- package.json
- pnpm-lock.yaml
- prisma/schema.prisma
- prisma/migrations/*
- env files
- middleware
- UI
- existing route handlers
- domain services
- auth-context-adapter.ts (no wiring change needed — already delegates to authjs adapter)

## Design Decisions

1. **Business scope from header only**: The adapter reads `x-business-id` header. Route handlers enforce route param ↔ context match separately (already implemented in `businesses/handler.ts`).
2. **Reuse TenancyService**: Used existing `TenancyService.resolveTenantContext()` via lazy composition root import rather than creating a new abstract `TenantMembershipResolver` interface.
3. **Lazy composition import**: `createDefaultAuthjsAdapter` lazily imports `getApiDependencies()` from `./composition` at call time, not at module load, avoiding Prisma initialization during static generation.
4. **resolveTenant delegates to resolveAuthenticated**: Ensures dual flag enforcement and session validation are always applied before tenant resolution.
5. **Trimmed businessId**: `x-business-id` header value is trimmed. Whitespace-only values are rejected with 400.
6. **Resolver error isolation**: If `tenantMembershipResolver` throws, returns `AUTH_CONTEXT_UNAVAILABLE` 501 (infrastructure failure). If it returns an error result, returns `ACCESS_DENIED` 403 (business logic).

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 6 warnings) |
| `pnpm test` | ✅ 821 passed, 7 skipped |
| `pnpm build` | ✅ |

## Decision

Accepted Auth.js tenant request-context resolver with explicit business scope behind feature flag; system context, middleware, and production rollout remain deferred.

## Recommended Next Task

[Phase 4] TASK-0041: Implement system request-context resolver with API key or service token
