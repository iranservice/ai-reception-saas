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
  ├── readAuthjsSession(request) → fail-safe session reader
  └── resetAuthjsRuntimeForTests()

/api/auth/[...nextauth]/route.ts
  └── GET/POST → delegates to getEnabledAuthjsRuntime()

authjs-context-adapter.ts
  └── resolveAuthenticated → lazy import of readAuthjsSession
```

Request-context does NOT depend on the auth route being hit first.

## Files Created

| File | Purpose |
|---|---|
| `src/lib/auth/authjs-runtime.ts` | Shared lazy runtime: `getEnabledAuthjsRuntime()`, `readAuthjsSession()` |
| `src/app/api/_shared/authjs-context-adapter.ts` | Auth.js request-context adapter with dual flag enforcement |
| `__tests__/api/authjs-request-context-adapter.test.ts` | 45 tests covering all adapter paths, flags, error catching, trimming, scope guards |
| `docs/checkpoints/TASK-0039-authjs-authenticated-request-context-resolver.md` | This checkpoint |

## Files Modified

| File | Change |
|---|---|
| `src/lib/auth/authjs-route-handlers.ts` | Added JWT + session callbacks to thread `user.id`; removed `setAuthjsAuth` call |
| `src/app/api/auth/[...nextauth]/route.ts` | Removed local cache; delegates to `getEnabledAuthjsRuntime()` |
| `src/lib/auth/index.ts` | Re-exports `getEnabledAuthjsRuntime`, `readAuthjsSession`, `resetAuthjsRuntimeForTests`, types |
| `src/app/api/_shared/auth-context-adapter.ts` | `getDefaultAuthContextAdapter()` checks `ENABLE_AUTHJS_REQUEST_CONTEXT` and delegates |
| `__tests__/auth/authjs-google-provider.test.ts` | Updated scope guards to check runtime instead of route |
| `__tests__/auth/authjs-route-handlers.test.ts` | Updated kill-switch pattern to match new runtime function |

## Feature Flags

| Flag | Purpose |
|---|---|
| `ENABLE_AUTHJS_REQUEST_CONTEXT` | Gates Auth.js request-context adapter (default: disabled) |
| `ENABLE_AUTHJS_RUNTIME` | Prerequisite: must also be enabled for Auth.js session resolution |

## Blocker Resolution

| # | Blocker | Resolution |
|---|---|---|
| 1 | Request-context depended on `/api/auth` route being hit first | Shared lazy runtime initializes independently |
| 2 | `authjs-runtime.ts` was only a getter/setter | Rewritten as shared lazy runtime with `getEnabledAuthjsRuntime()` |
| 3 | Route owned local `cachedEnabledHandlers` | Route delegates to shared runtime — no local cache |
| 4 | Adapter did not enforce `ENABLE_AUTHJS_REQUEST_CONTEXT` | Added as first gate in `resolveAuthenticated` |
| 5 | Adapter did not catch `auth(request)` errors | Wrapped in try/catch → returns 401 UNAUTHENTICATED |
| 6 | `session.user.id` validated with trim but raw value used | Now uses `userId.trim()` as the resolved value |
| 7 | Session callback did not populate `session.user.id` | Added JWT and session callbacks to thread `user.id` |

## Design Decisions

1. **Shared lazy runtime**: `authjs-runtime.ts` is the single owner of NextAuth initialization. Both route and adapter consume it.
2. **No circular imports**: `authjs-context-adapter.ts` uses dynamic `import()` for the runtime to avoid triggering the `next-auth` dependency chain at module load time.
3. **Dual flag enforcement**: `resolveAuthenticated` checks both `ENABLE_AUTHJS_REQUEST_CONTEXT` AND `ENABLE_AUTHJS_RUNTIME` before calling `auth()`.
4. **Fail-safe session reading**: `readAuthjsSession` catches all errors and returns null. The adapter separately catches errors and returns 401.
5. **Trimmed userId**: `session.user.id` is trimmed before use. Whitespace-only IDs are rejected with 400.
6. **JWT+session callbacks**: `jwt` callback persists `user.id` into `token.userId`; `session` callback threads it into `session.user.id`.

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Already up to date |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 7 warnings) |
| `pnpm test` | ✅ 810 passed, 7 skipped |
| `pnpm build` | ✅ |

## Decision

Implemented Auth.js authenticated request-context resolver behind dual feature flags with shared lazy runtime; tenant context, system context, middleware, and production rollout remain deferred.

## Recommended Next Task

[Phase 3] TASK-0040: Implement Auth.js JWT and session callback configuration for user ID enrichment
