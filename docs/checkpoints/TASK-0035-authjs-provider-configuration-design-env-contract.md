# TASK-0035: Auth.js Provider Configuration Design and Environment Contract

## Summary

Documentation-only architecture design task establishing the Auth.js provider configuration and environment contract before implementing real provider wiring. Defines Google OAuth as the first provider, required environment variable names and validation rules, feature-flag behavior, callback boundaries, rollout plan, failure modes, and security constraints.

## Files Created

- `docs/architecture/authjs-provider-environment-contract.md` — full architecture document
- `docs/checkpoints/TASK-0035-authjs-provider-configuration-design-env-contract.md` — this file

## Files Modified

None.

## Provider Decision

- **Selected:** Google OAuth as first provider.
- **Rationale:** Common OAuth baseline, stable Auth.js support, email/name/image always available, verified email guarantee, bundled in `next-auth` package (no new package needed).
- **Deferred:** GitHub, Email/Magic Link, Credentials, Passkeys/WebAuthn, Enterprise SSO, Apple, Supabase Auth, Clerk.

## Environment Variable Contract

### Required

| Variable | Purpose | When Required | Status |
|---|---|---|---|
| `ENABLE_AUTHJS_RUNTIME` | Runtime feature flag | Always | Existing (TASK-0033) |
| `ENABLE_AUTHJS_GOOGLE_PROVIDER` | Google provider feature flag | When Google provider rollout is desired | New — contract defined |
| `AUTH_SECRET` | JWT signing/encryption key | When `ENABLE_AUTHJS_RUNTIME === "true"` | Existing (TASK-0033) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | When both runtime AND Google provider flags are `"true"` | New — contract defined |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | When both runtime AND Google provider flags are `"true"` | New — contract defined |

### Optional

| Variable | Purpose | Status |
|---|---|---|
| `AUTH_URL` / `NEXTAUTH_URL` | Public base URL for auth callbacks | New — contract defined |
| `AUTH_TRUST_HOST` | Trust Host header behind proxy | New — contract defined |

### Naming Convention

Follows Auth.js v5 `AUTH_` prefix convention. Google provider auto-discovers `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

### Runtime Behavior Matrix

| `ENABLE_AUTHJS_RUNTIME` | `ENABLE_AUTHJS_GOOGLE_PROVIDER` | `AUTH_SECRET` | Google envs | Result |
|---|---|---|---|---|
| missing/false | any | any | any | Route disabled — 501 |
| `"true"` | missing/false | valid | any | Auth.js enabled with no real provider |
| `"true"` | `"true"` | missing | valid | Config error |
| `"true"` | `"true"` | valid | missing | Provider config error |
| `"true"` | `"true"` | valid | valid | Google provider configured |

## Validation Rules

- `AUTH_SECRET`: Non-empty string after trim (existing `validateAuthjsSecret`).
- `AUTH_GOOGLE_ID`: Non-empty string after trim (new validation, only when both runtime AND provider flags are `"true"`).
- `AUTH_GOOGLE_SECRET`: Non-empty string after trim (new validation, only when both runtime AND provider flags are `"true"`).
- All validation occurs at handler initialization time, not per-request.
- Runtime feature flag check remains per-request (kill switch).
- Provider feature flag is evaluated at initialization time.

## Feature-Flag Behavior

- `ENABLE_AUTHJS_RUNTIME` gates the entire Auth.js runtime (existing).
- `ENABLE_AUTHJS_GOOGLE_PROVIDER` gates the Google provider specifically (new).
- Both flags use strict exact `"true"` semantics — no trimming, no case normalization, no numeric truthy.
- Runtime disabled → 501 response.
- Runtime enabled + provider disabled → Auth.js runtime with empty providers.
- Runtime enabled + provider enabled → Google credentials required and provider configured.
- Kill switch semantics preserved — runtime flag checked before cache on every request.
- Provider flag evaluated at initialization time, not per-request.

## Callback Boundaries

- All callbacks flow through existing `src/app/api/auth/[...nextauth]/route.ts`.
- Google OAuth callback: `{AUTH_URL}/api/auth/callback/google`.
- No additional route files needed.
- No middleware added.
- No custom callback route created.

## Rollout Plan

| Phase | Scope | Task |
|---|---|---|
| Phase 1 | Provider configuration implementation (provider flag, credential validation, wire Google behind provider flag) | TASK-0036 |
| Phase 2 | Local E2E verification (Google Cloud Console, real OAuth flow) | Future |
| Phase 3 | Request context integration (production resolver) | Future |
| Phase 4 | Production hardening (cookies, CSRF, session rotation, audit) | Future |

## Security Constraints Documented

- AUTH_SECRET minimum 32 characters, cryptographically random.
- Provider secrets never committed to version control.
- PKCE enabled by default (Auth.js v5).
- OAuth state parameter automatic.
- JWT encrypted in HttpOnly/Secure/SameSite cookie.
- User.status enforced post-authentication.
- Dev auth context prohibited in production.
- Separate OAuth credentials per environment.

## Failure Modes Documented

- Credential validation failures (missing/empty secrets).
- OAuth flow failures (invalid credentials, redirect mismatch, user denied, provider down).
- User creation failures (missing email, duplicate email, DB connection).
- Feature flag failures (not set, wrong value, toggled).

## Architecture Debt Closed

- First provider selection closed — Google OAuth selected.
- Environment variable naming convention closed — `AUTH_` prefix per Auth.js v5.
- Provider credential validation pattern closed — follows existing `validateAuthjsSecret` pattern.
- Callback routing confirmed — existing catch-all route handles all callbacks.
- Per-provider feature flag decision closed — `ENABLE_AUTHJS_GOOGLE_PROVIDER` accepted for safe rollout.
- Account linking behavior documented for Google OAuth.

## Checks Run

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ (no source changes) |
| `pnpm lint` | ✅ (no source changes) |
| `pnpm test` | ✅ (no source changes) |
| `pnpm build` | ✅ (no source changes) |

## Issues Found

None.

## Decision

Accepted Google OAuth as first Auth.js provider candidate, with strict environment contract and provider implementation deferred.

## Recommended Next Task

[Phase 2] TASK-0036: Implement Google provider configuration behind provider feature flag

## Scope Confirmation

- ✅ Documentation only
- ✅ No source code changes
- ✅ No package changes
- ✅ No lockfile changes
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No route changes
- ✅ No auth module changes
- ✅ No adapter changes
- ✅ No test changes
- ✅ No middleware
- ✅ No provider secrets
- ✅ No env file changes
- ✅ No workflow changes
- ✅ No UI
- ✅ No Google Cloud Console setup
- ✅ Internal Session unchanged
- ✅ Tenant/authz ownership unchanged
