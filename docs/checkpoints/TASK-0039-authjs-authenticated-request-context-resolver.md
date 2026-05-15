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

## Architecture — Shared Lazy Runtime

The Auth.js runtime is a shared lazy singleton in `authjs-runtime.ts`. Both the auth route handler (`/api/auth/[...nextauth]/route.ts`) and the request-context adapter consume it — neither owns initialization.

```
authjs-runtime.ts (shared lazy runtime)
  ├── getEnabledAuthjsRuntime()  → lazily creates and caches NextAuth
  ├── readAuthjsSession(request) → throws on infrastructure error, null on no-session
  ├── AuthjsSessionReadError     → controlled error for infrastructure failures
  └── resetAuthjsRuntimeForTests()

/api/auth/[...nextauth]/route.ts
  └── GET/POST → delegates to getEnabledAuthjsRuntime()

authjs-context-adapter.ts
  └── resolveAuthenticated → lazy import of readAuthjsSession
```

Request-context does NOT depend on the auth route being hit first.

## Error Contract

| Condition | Code | Status |
|---|---|---|
| `ENABLE_AUTHJS_REQUEST_CONTEXT` disabled | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| `ENABLE_AUTHJS_RUNTIME` disabled | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| `auth(request)` throws | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| `auth(request)` returns null | `UNAUTHENTICATED` | 401 |
| `session.user` missing | `UNAUTHENTICATED` | 401 |
| `session.user.id` missing/empty/whitespace | `INVALID_AUTH_CONTEXT` | 400 |
| Valid `session.user.id` | Success | — |
| Tenant resolver | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| System resolver | `AUTH_CONTEXT_UNAVAILABLE` | 501 |

## Files Created

| File | Purpose |
|---|---|
| `src/lib/auth/authjs-runtime.ts` | Shared lazy runtime: `getEnabledAuthjsRuntime()`, `readAuthjsSession()`, `AuthjsSessionReadError` |
| `src/app/api/_shared/authjs-context-adapter.ts` | Auth.js request-context adapter with dual flag enforcement |
| `__tests__/api/authjs-request-context-adapter.test.ts` | Tests covering all adapter paths, flags, error handling, trimming, scope guards |
| `docs/checkpoints/TASK-0039-authjs-authenticated-request-context-resolver.md` | This checkpoint |

## Files Modified

| File | Change |
|---|---|
| `src/lib/auth/authjs-route-handlers.ts` | JWT + session callbacks using `token.sub`; request-aware auth wrapper; removed `setAuthjsAuth` call |
| `src/app/api/auth/[...nextauth]/route.ts` | Removed local cache; delegates to `getEnabledAuthjsRuntime()` |
| `src/lib/auth/index.ts` | Re-exports `getEnabledAuthjsRuntime`, `readAuthjsSession`, `resetAuthjsRuntimeForTests`, `AuthjsSessionReadError`, types |
| `src/app/api/_shared/auth-context-adapter.ts` | `getDefaultAuthContextAdapter()` checks `ENABLE_AUTHJS_REQUEST_CONTEXT` and delegates |
| `__tests__/auth/authjs-google-provider.test.ts` | Updated scope guards to check runtime instead of route |
| `__tests__/auth/authjs-route-handlers.test.ts` | Updated kill-switch pattern to match new runtime function |

## Feature Flags

| Flag | Purpose |
|---|---|
| `ENABLE_AUTHJS_REQUEST_CONTEXT` | Gates Auth.js request-context adapter (default: disabled) |
| `ENABLE_AUTHJS_RUNTIME` | Prerequisite: must also be enabled for Auth.js session resolution |

## Design Decisions

1. **Shared lazy runtime**: `authjs-runtime.ts` is the single owner of NextAuth initialization. Both route and adapter consume it.
2. **No circular imports**: `authjs-context-adapter.ts` uses dynamic `import()` for the runtime to avoid triggering the Auth.js package dependency chain at module load time.
3. **Dual flag enforcement**: `resolveAuthenticated` checks both `ENABLE_AUTHJS_REQUEST_CONTEXT` AND `ENABLE_AUTHJS_RUNTIME` before calling `auth()`.
4. **Strict error semantics**: `readAuthjsSession` throws `AuthjsSessionReadError` for infrastructure failures (runtime init, missing auth, auth throws). Only genuine Auth.js "no session" returns null. The adapter catches these and returns `AUTH_CONTEXT_UNAVAILABLE` 501.
5. **Trimmed userId**: `session.user.id` is trimmed before use. Whitespace-only IDs are rejected with 400.
6. **Standard token.sub contract**: JWT callback sets `token.sub` from `user.id` (Auth.js standard subject claim); session callback threads `token.sub` into `session.user.id`.
7. **Request-aware auth wrapper**: `AuthjsRouteHandlerOutput.auth` is narrowed from NextAuth's overloaded signatures to `(request: Request) => Promise<Record | null>` via a wrapper function.

## Checks Run

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 7 warnings) |
| `pnpm test` | ✅ All passed |
| `pnpm build` | ✅ |

## Decision

Accepted: Auth.js authenticated request-context resolver implemented behind ENABLE_AUTHJS_REQUEST_CONTEXT and ENABLE_AUTHJS_RUNTIME dual feature flags with shared lazy runtime, strict AUTH_CONTEXT_UNAVAILABLE error contract, and token.sub session enrichment; tenant context, system context, and production rollout deferred.

## Recommended Next Task

TASK-0040: Implement Auth.js tenant membership context resolver behind feature flag
