# TASK-0038: Auth.js Request-Context Resolver Design for Provider-Backed Sessions

## Summary

Documentation/design task defining how future API request-context resolution will use Auth.js provider-backed sessions while preserving current tenant/authz boundaries. No source code, tests, configuration, or runtime behavior was modified.

## Files Created

- `docs/architecture/authjs-request-context-resolver-design.md` — architecture design document
- `docs/checkpoints/TASK-0038-authjs-request-context-resolver-design.md` — this file

## Files Modified

None. This is a documentation-only task.

## Design Contents

### Proposed Resolver Architecture

- New adapter factory: `createAuthjsRequestContextAdapter` accepting request-aware `auth(request: Request)` and neutral `TenantMembershipResolver` interface (no concrete repository or factory names committed)
- `resolveAuthenticated`: calls `auth(request)` → extracts `session.user.id` → returns `AuthenticatedUserRequestContext`
- `resolveTenant`: combines authenticated user ID + tenant source (route param priority, then `x-business-id` header) + membership lookup → returns `TenantRequestContext`
- `resolveSystem`: remains separate from Auth.js (API key / service token)

### Feature Flag Strategy

- New flag: `ENABLE_AUTHJS_REQUEST_CONTEXT` (exact `"true"` semantics)
- When disabled: dev header adapter active (current behavior preserved)
- When enabled: Auth.js session adapter active
- Requires `ENABLE_AUTHJS_RUNTIME === "true"` as prerequisite — config error if mismatched

### Session Shape Prerequisite

- Auth.js v5 does not include `user.id` in JWT by default
- Prerequisite task must add `jwt` and `session` callbacks to copy `token.sub` → `session.user.id`
- Without this, resolver always fails with `INVALID_AUTH_CONTEXT`

### Rollout Plan

| Phase | Description | Status |
|---|---|---|
| Phase 1 | JWT callback setup (prerequisite) | Not started |
| Phase 2 | Auth.js request-context adapter implementation | Not started |
| Phase 3 | Tenant resolution with membership lookup | Not started |
| Phase 4 | System context production mechanism | Not started |
| Phase 5 | Migration from dev headers to production | Not started |

### Open Design Questions

1. Tenant identifier source order: resolved — route param `businessId` first (business-scoped routes), `x-business-id` header only for generic routes, query/body not accepted, session/JWT must not silently choose, last-used tenant deferred; prevents confused-deputy and stale JWT claims
2. JWT enrichment scope: cache membership in JWT vs per-request DB lookup (recommend per-request)
3. System context production mechanism: API key vs service token vs mTLS (deferred)

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 5 warnings) |
| `pnpm test` | ✅ 769 passed, 7 skipped |
| `pnpm build` | ✅ |

## Scope Confirmation

- ✅ No source code changes
- ✅ No test changes
- ✅ No package.json changes
- ✅ No lockfile changes
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No env file changes
- ✅ No secrets committed
- ✅ No middleware
- ✅ No UI
- ✅ No route changes
- ✅ No workflow changes
- ✅ No domain service changes
- ✅ No adapter changes
- ✅ No request-context runtime changes

## Decision

Accepted Auth.js request-context resolver design defining: (1) strict tenant scope source order — route param `businessId` first, `x-business-id` header only for generic routes, query/body/JWT/last-used rejected or deferred; (2) neutral `TenantMembershipResolver` interface with no concrete repository or factory function names committed; (3) request-aware `auth(request)` session boundary enforced by adapter factory signature; (4) JWT callback prerequisite for `session.user.id` confirmed; (5) five-phase rollout plan with production deployment deferred.

## Recommended Next Task

[Phase 1] TASK-0039: Auth.js JWT and session callback configuration for user ID enrichment
