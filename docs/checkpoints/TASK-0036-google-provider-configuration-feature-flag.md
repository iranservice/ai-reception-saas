# TASK-0036: Google Provider Configuration Behind Provider Feature Flag

## Summary

Implementation task that wires Google OAuth provider configuration into the existing Auth.js route handler, gated behind a provider-specific feature flag (`ENABLE_AUTHJS_GOOGLE_PROVIDER`). Google provider is only added to the providers array when both the runtime flag and the provider flag are enabled. When the provider flag is disabled, Auth.js runtime can still run with an empty providers array.

## Files Created

- `src/lib/auth/authjs-google-provider.ts` — Google provider configuration primitives
- `__tests__/auth/authjs-google-provider.test.ts` — comprehensive test suite (53 tests)
- `docs/checkpoints/TASK-0036-google-provider-configuration-feature-flag.md` — this file

## Files Modified

- `src/app/api/auth/[...nextauth]/route.ts` — passes `createAuthjsProviders()` instead of `[]`
- `src/lib/auth/index.ts` — re-exports Google provider primitives

## Implementation Details

### New Module: `src/lib/auth/authjs-google-provider.ts`

Exports:

| Export | Type | Purpose |
|---|---|---|
| `AUTHJS_GOOGLE_PROVIDER_FEATURE_FLAG` | Constant | `"ENABLE_AUTHJS_GOOGLE_PROVIDER"` |
| `AUTHJS_GOOGLE_PROVIDER_ID` | Constant | `"google"` |
| `AUTHJS_GOOGLE_MISSING_CLIENT_ID_MESSAGE` | Constant | Error message for missing client ID |
| `AUTHJS_GOOGLE_MISSING_CLIENT_SECRET_MESSAGE` | Constant | Error message for missing client secret |
| `isAuthjsGoogleProviderEnabled` | Function | Strict `"true"` flag check |
| `validateGoogleProviderCredentials` | Function | Validates AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET |
| `createGoogleAuthProvider` | Function | Creates Google provider config from credentials |
| `createAuthjsProviders` | Function | Builds providers array from flags |
| `GoogleProviderCredentials` | Type | `{ clientId, clientSecret }` |
| `GoogleProviderEnv` | Type | Environment subset type |

### Feature Flag Semantics

- `ENABLE_AUTHJS_GOOGLE_PROVIDER` must be exact string `"true"` to enable.
- No trimming, no case normalization, no numeric truthy.
- `"TRUE"`, `"1"`, `"yes"`, `" true "` are all treated as disabled.
- Follows same strict pattern as `ENABLE_AUTHJS_RUNTIME`.

### Runtime Behavior Matrix

| `ENABLE_AUTHJS_RUNTIME` | `ENABLE_AUTHJS_GOOGLE_PROVIDER` | `AUTH_SECRET` | Google envs | Result |
|---|---|---|---|---|
| missing/false | any | any | any | Route disabled — 501 |
| `"true"` | missing/false | valid | any | Auth.js enabled with no real provider |
| `"true"` | `"true"` | missing | valid | Config error — AUTH_SECRET validation throws |
| `"true"` | `"true"` | valid | missing | Provider config error — Google credential validation throws |
| `"true"` | `"true"` | valid | valid | Google provider configured and active |

### Route Handler Change

- `providers: []` replaced with `providers: createAuthjsProviders()`
- When provider flag is disabled, `createAuthjsProviders()` returns `[]` (identical to prior behavior)
- When provider flag is enabled, returns `[Google({ clientId, clientSecret })]`
- Kill switch semantics preserved — runtime flag checked before cache on every request

## Validation Rules

- `AUTH_GOOGLE_ID`: Non-empty string after trim (required only when both flags are `"true"`)
- `AUTH_GOOGLE_SECRET`: Non-empty string after trim (required only when both flags are `"true"`)
- Validation follows existing `validateAuthjsSecret` pattern
- Credentials validated at handler initialization time, not per-request
- Provider flag evaluated at initialization time, not per-request

## Checks Run

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 5 warnings) |
| `pnpm test` | ✅ 763 passed, 7 skipped |
| `pnpm build` | ✅ |

## Test Coverage

53 new tests in `__tests__/auth/authjs-google-provider.test.ts`:

| Test Group | Count | What It Covers |
|---|---|---|
| Constants | 4 | Flag name, provider ID, error message content |
| `isAuthjsGoogleProviderEnabled` | 10 | Exact `"true"`, `"TRUE"`, `"True"`, `"1"`, `"yes"`, `" true "`, empty, undefined, process.env default |
| `validateGoogleProviderCredentials` | 12 | Valid creds, trimming, missing/empty/whitespace/undefined for both fields, order, process.env |
| `createGoogleAuthProvider` | 2 | Calls Google(), returns config |
| `createAuthjsProviders` | 9 | Disabled flags (5 variants), enabled with valid creds, missing creds, flag-disabled skips validation |
| Type exports | 2 | Shape verification |
| Scope guards | 14 | File existence, imports, isolation, route wiring, barrel exports, domain isolation, no middleware, no schema, no migration, no package changes |

## Architecture Debt Closed

- Google provider wiring closed — provider configured behind provider flag.
- Provider credential validation closed — follows `validateAuthjsSecret` pattern.
- Provider-specific feature flag implemented — `ENABLE_AUTHJS_GOOGLE_PROVIDER`.
- Route handler uses `createAuthjsProviders()` — no hardcoded providers.

## Issues Found

None.

## Decision

Accepted Google OAuth provider configuration behind provider feature flag, with runtime and provider flags as separate gates.

## Recommended Next Task

[Phase 2] TASK-0037: Local end-to-end Google OAuth verification with Google Cloud Console credentials

## Scope Confirmation

- ✅ No new packages installed
- ✅ No package.json changes
- ✅ No lockfile changes
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No env file changes
- ✅ No provider secrets committed
- ✅ No middleware
- ✅ No UI
- ✅ No request-context resolver changes
- ✅ No domain service changes
- ✅ No adapter changes
- ✅ No session strategy changes
- ✅ No workflow changes
- ✅ Existing tests unchanged
- ✅ Kill switch semantics preserved
