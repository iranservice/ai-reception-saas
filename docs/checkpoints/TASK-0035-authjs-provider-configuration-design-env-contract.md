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

### Required (when `ENABLE_AUTHJS_RUNTIME=true`)

| Variable | Purpose | Status |
|---|---|---|
| `ENABLE_AUTHJS_RUNTIME` | Feature flag | Existing (TASK-0033) |
| `AUTH_SECRET` | JWT signing/encryption key | Existing (TASK-0033) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | New — contract defined |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | New — contract defined |

### Optional

| Variable | Purpose | Status |
|---|---|---|
| `AUTH_URL` / `NEXTAUTH_URL` | Public base URL for auth callbacks | New — contract defined |
| `AUTH_TRUST_HOST` | Trust Host header behind proxy | New — contract defined |

### Naming Convention

Follows Auth.js v5 `AUTH_` prefix convention. Google provider auto-discovers `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

## Validation Rules

- `AUTH_SECRET`: Non-empty string after trim (existing `validateAuthjsSecret`).
- `AUTH_GOOGLE_ID`: Non-empty string after trim (new validation function needed).
- `AUTH_GOOGLE_SECRET`: Non-empty string after trim (new validation function needed).
- All validation occurs at handler initialization time, not per-request.
- Feature flag check remains per-request (kill switch).

## Feature-Flag Behavior

- No new feature flag for Google provider.
- `ENABLE_AUTHJS_RUNTIME` gates the entire auth runtime including all providers.
- Kill switch semantics preserved — flag checked before cache on every request.
- Per-provider flags deferred until multiple providers are active simultaneously.

## Callback Boundaries

- All callbacks flow through existing `src/app/api/auth/[...nextauth]/route.ts`.
- Google OAuth callback: `{AUTH_URL}/api/auth/callback/google`.
- No additional route files needed.
- No middleware added.
- No custom callback route created.

## Rollout Plan

| Phase | Scope | Task |
|---|---|---|
| Phase 1 | Provider configuration implementation (wire Google, add validation) | TASK-0036 |
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
- Per-provider feature flag decision closed — not needed for single provider.
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

Accepted Auth.js provider environment contract: Google OAuth as first provider, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET as required environment variables, validation follows existing AUTH_SECRET pattern, no new feature flag, kill switch semantics preserved, and implementation deferred to next task.

## Recommended Next Task

[Phase 2] TASK-0036: Auth.js Google OAuth provider wiring behind feature flag

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
