# TASK-0039 — Auth.js Authenticated Request-Context Resolver

| Field | Value |
|---|---|
| Task ID | TASK-0039 |
| Title | Implement Auth.js authenticated request-context resolver behind feature flag |
| Status | Complete |
| Branch | task-0039-authjs-authenticated-request-context-resolver |
| Baseline | PR #43 merged (ca87276) |
| Scope | Source code + tests + documentation |

## Summary

Implements Auth.js-backed authenticated request-context resolution gated behind `ENABLE_AUTHJS_REQUEST_CONTEXT`. When enabled, `getDefaultAuthContextAdapter()` returns an Auth.js session-backed adapter that resolves `AuthenticatedUserRequestContext` from JWT sessions. Tenant and system context resolution remain explicitly unavailable in the Auth.js adapter, deferred to future tasks.

## Files Created

| File | Purpose |
|---|---|
| `src/lib/auth/authjs-runtime.ts` | Singleton accessor for Auth.js `auth()` function shared between route handler and adapter |
| `src/app/api/_shared/authjs-context-adapter.ts` | Auth.js request-context adapter: resolveAuthenticated from session, tenant/system deferred |
| `__tests__/api/authjs-request-context-adapter.test.ts` | 38 tests covering adapter, feature flags, session shapes, scope guards |
| `docs/checkpoints/TASK-0039-authjs-authenticated-request-context-resolver.md` | This checkpoint |

## Files Modified

| File | Change |
|---|---|
| `src/lib/auth/authjs-route-handlers.ts` | Added `auth` field to `AuthjsRouteHandlerOutput`; calls `setAuthjsAuth(nextAuth.auth)` during initialization |
| `src/app/api/auth/[...nextauth]/route.ts` | Added TASK-0039 comment to header |
| `src/lib/auth/index.ts` | Re-exports `getAuthjsAuth`, `setAuthjsAuth`, `resetAuthjsAuthForTests`, `AuthjsAuthFunction` |
| `src/app/api/_shared/auth-context-adapter.ts` | `getDefaultAuthContextAdapter()` now checks `ENABLE_AUTHJS_REQUEST_CONTEXT` and delegates to Auth.js adapter when enabled |

## Feature Flags

| Flag | Purpose |
|---|---|
| `ENABLE_AUTHJS_REQUEST_CONTEXT` | Gates Auth.js request-context adapter (default: disabled, falls back to dev-header adapter) |
| `ENABLE_AUTHJS_RUNTIME` | Prerequisite: must also be enabled for Auth.js session resolution to work |

## Design Decisions

1. **No circular imports**: `authjs-context-adapter.ts` does not import from `auth-context-adapter.ts`. Shared helpers are inlined locally.
2. **No direct Auth.js package import**: The adapter receives `auth` as an injected dependency. No `next-auth` import in `src/app/**`.
3. **Scope guard compliance**: All existing scope guards pass. New file avoids forbidden strings (`next-auth`, `authjs-feature-gate`, `getPrisma`, etc.) in `src/app/**`.
4. **Structural typing**: `AuthjsAuthContextAdapter` and `AuthContextAdapter` are structurally identical, ensuring compatibility via TypeScript structural typing.
5. **Auth runtime singleton**: `authjs-runtime.ts` provides `getAuthjsAuth()`/`setAuthjsAuth()` — set once during route handler init, read by the adapter factory.
6. **Tenant/system always 501**: Auth.js adapter explicitly returns `AUTH_CONTEXT_UNAVAILABLE` for tenant and system context, with deferred messages.

## Architectural Boundaries Preserved

- Email is not used as userId — only `session.user.id` (internal DB UUID)
- Provider account ID is never internal user ID
- Tenant context is not inferred from session
- System context remains separate
- Dev header adapter remains default when Auth.js flag is disabled
- No middleware added
- No Prisma schema changes
- No migrations
- No env file changes

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Already up to date |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 8 warnings) |
| `pnpm test` | ✅ 807 passed, 7 skipped |
| `pnpm build` | ✅ |

## Decision

Implemented Auth.js authenticated request-context resolver behind ENABLE_AUTHJS_REQUEST_CONTEXT feature flag; tenant context, system context, middleware, and production rollout remain deferred.

## Recommended Next Task

[Phase 3] TASK-0040: Implement Auth.js JWT and session callback configuration for user ID enrichment
