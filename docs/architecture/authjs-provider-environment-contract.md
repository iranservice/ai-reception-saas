# Auth.js Provider Configuration and Environment Contract

## Status

Accepted design proposal for next implementation task.

## Date

2026-05-15

## Baseline

- **Main commit:** `d11d35bb3f2a6de5b350c4090a54e3d5a8ceb51e`
- **Prior checkpoint:** TASK-0034B — Auth.js route feature flag kill switch fix
- **Current task:** TASK-0035
- **Decision scope:** Documentation/design only

## Context

The project has completed the following Auth.js integration phases:

| Task | Status | What It Delivered |
|---|---|---|
| TASK-0026 | ✅ Accepted | Runtime authentication strategy ADR — Auth.js selected as first provider candidate |
| TASK-0027 | ✅ Accepted | Compatibility review — gaps identified (emailVerified, Account, Session naming) |
| TASK-0028 | ✅ Accepted | Schema design — prefixed naming proposed, session strategy deferred |
| TASK-0029 | ✅ Accepted | Prisma adapter spike — prefixed names rejected, exact names + JWT strategy adopted |
| TASK-0030 | ✅ Accepted | Migration proposal — Account, VerificationToken, emailVerified proposed |
| TASK-0030B | ✅ Accepted | User adapter contract — image→avatarUrl, required email/name, thin wrapper |
| TASK-0031 | ✅ Accepted | Schema migration applied — Account, VerificationToken, User.emailVerified |
| TASK-0032 | ✅ Accepted | Package installation + adapter wrapper — next-auth, @auth/prisma-adapter installed |
| TASK-0033 | ✅ Accepted | Runtime config factory — feature gate, secret validation, JWT strategy enforced |
| TASK-0034 | ✅ Accepted | Route wiring — GET/POST behind feature flag, 501 disabled response |
| TASK-0034B | ✅ Accepted | Kill switch fix — flag checked before cache on every request |

**Current state:**

- `next-auth@5.0.0-beta.31` and `@auth/prisma-adapter@^2.11.2` are installed.
- Adapter wrapper exists with image→avatarUrl mapping, required email enforcement, name fallback.
- Route handler exists at `src/app/api/auth/[...nextauth]/route.ts` behind `ENABLE_AUTHJS_RUNTIME` feature flag.
- Runtime is disabled by default — returns 501 structured JSON when disabled.
- Kill switch checks flag before cached handlers on every request.
- JWT session strategy is enforced.
- **Providers array is empty** — no real OAuth provider is configured.
- No provider secrets exist in env.
- No callback URLs are configured.

This document defines the provider and environment contract **before** implementing real provider wiring.

## Provider Decision

### Selected First Provider: Google OAuth

Google OAuth is selected as the first provider for implementation.

**Rationale:**

- **Common OAuth baseline** — Google OAuth is the most widely used OAuth provider globally. It provides a well-understood baseline for verifying the end-to-end OAuth flow.
- **Stable Auth.js support** — Auth.js has first-class, mature support for Google via `next-auth/providers/google`. The provider is bundled with the `next-auth` package (no additional package installation required).
- **Email identity available** — Google always provides a verified email address, which maps directly to the internal `User.email` (required field). This avoids the "missing email" hard failure path.
- **Image and name available** — Google profile data includes display name and profile picture, which map to internal `User.name` and `User.avatarUrl` through the accepted adapter contract.
- **Good test provider** — Google OAuth exercises the full OAuth flow: redirect → consent → callback → token exchange → profile fetch → user creation/linking.
- **Verified email guarantee** — Google accounts have verified email by default, which simplifies the `User.emailVerified` flow for the initial rollout.

### Providers Explicitly Not Selected Now

| Provider | Reason for Deferral |
|---|---|
| GitHub OAuth | Good alternative but less universal than Google for end-user SaaS products. Can be added as a second OAuth provider after Google is verified. |
| Email / Magic Link | Requires email sending infrastructure (SMTP or API). Increases implementation scope. Should be a separate provider task. |
| Credentials / Password | Auth.js strongly discourages custom credentials for security reasons. Higher implementation burden. Not recommended for first provider. |
| Passkeys / WebAuthn | Experimental in Auth.js v5. Requires `Authenticator` model (deferred in schema design). Not ready for initial rollout. |
| Enterprise SSO / SAML | Enterprise feature. Requires tenant-specific provider configuration. Out of scope for initial auth rollout. |
| Apple | Requires Apple Developer Program enrollment and specific callback domain verification. Higher setup friction for initial rollout. |
| Supabase Auth | Project does not use Supabase scaffold. Would introduce platform coupling. |
| Clerk | Would duplicate internal Business/Membership model. Rejected in strategy ADR. |

## Provider Package Strategy

The Google provider is **bundled** with the `next-auth` package. No additional package installation is required.

**Import path:**

```ts
import Google from 'next-auth/providers/google';
```

**Verified:** `node_modules/next-auth/providers/google.js` exists in the current installation (`next-auth@5.0.0-beta.31`).

**No new packages needed for the implementation task.**

## Environment Variable Contract

### Required Variables

| Variable | Purpose | Format | Validation Rule | When Needed |
|---|---|---|---|---|
| `ENABLE_AUTHJS_RUNTIME` | Feature flag for Auth.js runtime | Exact string `"true"` | Strict equality — only `"true"` enables; `"TRUE"`, `"1"`, `" true "` are all disabled | Always (existing) |
| `AUTH_SECRET` | JWT signing and encryption key | Non-empty string, minimum 32 characters recommended | Reject null/undefined/empty/whitespace-only | When `ENABLE_AUTHJS_RUNTIME=true` (existing validation) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Non-empty string, format `*.apps.googleusercontent.com` | Reject null/undefined/empty/whitespace-only | When Google provider is configured |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Non-empty string | Reject null/undefined/empty/whitespace-only | When Google provider is configured |

### Optional Variables

| Variable | Purpose | Format | Default | Notes |
|---|---|---|---|---|
| `AUTH_URL` / `NEXTAUTH_URL` | Public base URL for auth callbacks | Full URL (e.g., `https://app.example.com`) | Auto-detected by Auth.js in many hosting environments | Required for production; optional in local dev where `localhost:3000` is inferred |
| `AUTH_TRUST_HOST` | Trust the `Host` header for callback URL resolution | `"true"` | Not set (Auth.js auto-detects in Vercel/Netlify) | May be needed for custom hosting behind reverse proxy |

### Variable Naming Convention

Auth.js v5 uses the `AUTH_` prefix convention for environment variables:

- `AUTH_SECRET` — recognized automatically by Auth.js v5.
- `AUTH_GOOGLE_ID` — recognized automatically by the Google provider when using the `AUTH_` prefix convention.
- `AUTH_GOOGLE_SECRET` — recognized automatically by the Google provider when using the `AUTH_` prefix convention.

Auth.js v5 auto-discovery: when the Google provider is instantiated with `Google()` (no explicit arguments), it automatically reads `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from the environment. Explicit passing is also supported for validation purposes.

### Variables NOT Added or Changed in This Task

This task does not create, modify, or populate any environment files (`.env`, `.env.local`, `.env.example`). Variable names are defined here as a contract only. Actual values will be set in the implementation task.

## Validation Rules

### Startup-Time Validation (at route handler initialization)

When `ENABLE_AUTHJS_RUNTIME=true`, the following validations must pass before the route handler initializes:

| Check | Validation | Failure Behavior |
|---|---|---|
| `AUTH_SECRET` | Non-empty string after trim | Throw `Error` — handler does not initialize |
| `AUTH_GOOGLE_ID` | Non-empty string after trim | Throw `Error` — handler does not initialize |
| `AUTH_GOOGLE_SECRET` | Non-empty string after trim | Throw `Error` — handler does not initialize |

**Existing validation:** `AUTH_SECRET` validation already exists in `validateAuthjsSecret()` (`src/lib/auth/authjs-runtime-config.ts`).

**New validation needed:** Google provider credentials must be validated before passing to the provider constructor. Validation should follow the same pattern — reject null/undefined/empty/whitespace-only.

### Runtime Validation (per-request)

| Check | Validation | Failure Behavior |
|---|---|---|
| `ENABLE_AUTHJS_RUNTIME` | Exact `"true"` check | Return 501 structured JSON (existing kill switch) |

No per-request validation of provider secrets — secrets are validated once at initialization and cached.

## Feature-Flag Behavior

### Existing Flag: `ENABLE_AUTHJS_RUNTIME`

The existing feature flag behavior is unchanged:

| Flag State | Route Behavior | Provider Behavior |
|---|---|---|
| Not set / any value except `"true"` | Returns 501 `AUTHJS_RUNTIME_DISABLED` JSON | No provider initialization, no Prisma call, no NextAuth call |
| `"true"` | Initializes NextAuth, delegates to handlers | Google provider is configured and active |

### No New Feature Flag for Google Provider

A separate feature flag for Google OAuth is **not recommended** at this stage.

**Rationale:**

- The entire Auth.js runtime is already gated behind `ENABLE_AUTHJS_RUNTIME`.
- Adding a second flag (`ENABLE_GOOGLE_PROVIDER`) would add complexity with minimal benefit.
- If Google OAuth needs to be disabled while Auth.js runtime stays enabled, the runtime can simply be disabled entirely — there are no other active providers.
- A per-provider feature flag should be introduced only when multiple providers are active simultaneously.

### Kill Switch Semantics (Preserved)

- Flag is checked **before** accessing cached handlers on every GET and POST request.
- Disabling the flag immediately takes effect — cached handlers are never returned while disabled.
- Re-enabling the flag re-initializes handlers on the next request.
- No process restart required for flag changes.

## Callback Boundaries

### Auth.js Route Path

The Auth.js catch-all route is at:

```
/api/auth/[...nextauth]
```

This handles all Auth.js callback paths:

| Callback Path | Purpose | HTTP Method |
|---|---|---|
| `/api/auth/signin` | Sign-in page (if default UI is used) | GET |
| `/api/auth/signin/google` | Initiate Google OAuth flow | POST |
| `/api/auth/callback/google` | Google OAuth callback (redirect from Google) | GET |
| `/api/auth/signout` | Sign-out | POST |
| `/api/auth/session` | Get current session | GET |
| `/api/auth/csrf` | Get CSRF token | GET |
| `/api/auth/providers` | List available providers | GET |

### Google OAuth Callback URL

The callback URL that must be registered in the Google Cloud Console is:

```
{AUTH_URL}/api/auth/callback/google
```

For local development:

```
http://localhost:3000/api/auth/callback/google
```

For production:

```
https://{production-domain}/api/auth/callback/google
```

### Callback Boundary Rules

- All callbacks flow through the existing `src/app/api/auth/[...nextauth]/route.ts` catch-all.
- No additional route files are needed.
- No middleware is added for callbacks.
- Callback processing is entirely handled by NextAuth internally.
- The adapter wrapper intercepts `createUser`/`updateUser` to normalize data before writing to the database.
- The adapter maps provider `image` to internal `avatarUrl`.
- The adapter enforces required `email` and provides `name` fallback.

### No Custom Callback Route

No custom `/api/auth/callback/google` route file is created. Auth.js handles callback routing internally through the catch-all `[...nextauth]` route.

## Google Cloud Console Setup Requirements

The implementation task will need to document:

1. **Create OAuth 2.0 Client ID** in Google Cloud Console.
2. **Application type:** Web application.
3. **Authorized redirect URIs:** Add the callback URL(s) for all environments.
4. **Authorized JavaScript origins:** Add the application origin(s).
5. **Consent screen:** Configure with appropriate application name and scopes.
6. **Scopes required:** `openid`, `email`, `profile` (default Auth.js Google scopes).

**This setup is NOT performed in TASK-0035.** This is documented as a prerequisite for the implementation task.

## Provider Configuration Shape

The future provider configuration in the route handler will follow this pattern:

```ts
// Future implementation — NOT applied in this task

import Google from 'next-auth/providers/google';

// In route.ts getEnabledHandlers():
cachedEnabledHandlers = createAuthjsRouteHandlers({
  prisma: getPrisma(),
  authSecret: process.env.AUTH_SECRET ?? '',
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  basePath: '/api/auth',
  debug: process.env.NODE_ENV === 'development',
});
```

**Key design decisions:**

- Provider is passed through the existing `providers` array in `AuthjsRouteHandlerInput`.
- `createAuthjsRouteHandlers` already accepts `providers?: unknown[]`.
- No changes to the factory interface are needed.
- Provider credentials are read from environment at handler initialization time (lazy, deferred to first request).
- Provider credentials are NOT read at import time (avoids build-time failures).

### Provider Credential Validation Function

A new validation function should be created following the existing `validateAuthjsSecret` pattern:

```ts
// Future implementation — NOT applied in this task

export function validateGoogleProviderCredentials(env: NodeJS.ProcessEnv): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = env.AUTH_GOOGLE_SECRET?.trim();

  if (!clientId) {
    throw new Error(
      'AUTH_GOOGLE_ID is required when ENABLE_AUTHJS_RUNTIME is enabled. ' +
      'Provide a valid Google OAuth client ID.'
    );
  }

  if (!clientSecret) {
    throw new Error(
      'AUTH_GOOGLE_SECRET is required when ENABLE_AUTHJS_RUNTIME is enabled. ' +
      'Provide a valid Google OAuth client secret.'
    );
  }

  return { clientId, clientSecret };
}
```

## Rollout Plan

### Phase 1 — Provider Configuration Implementation (Next Task)

| Step | Description | Risk |
|---|---|---|
| 1 | Create Google provider credential validation function | Low |
| 2 | Add Google provider to route handler `providers` array | Low |
| 3 | Add provider configuration tests | Low |
| 4 | Add credential validation tests | Low |
| 5 | Update scope guard tests for Google provider import | Low |
| 6 | Create checkpoint document | Low |

**Scope constraints for the next task:**

- Only wire the Google provider into the existing route handler.
- Only add credential validation.
- Do NOT create Google Cloud Console credentials.
- Do NOT populate `.env` files with secrets.
- Do NOT add login UI.
- Do NOT add middleware.
- Do NOT add request-context integration.
- Do NOT change the adapter.
- Do NOT change the schema.

### Phase 2 — Local End-to-End Verification (Future Task)

| Step | Description |
|---|---|
| 1 | Set up Google Cloud Console OAuth credentials for development |
| 2 | Populate local `.env.local` with `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` |
| 3 | Enable `ENABLE_AUTHJS_RUNTIME=true` locally |
| 4 | Test full OAuth flow: redirect → consent → callback → session |
| 5 | Verify User creation through adapter wrapper |
| 6 | Verify Account linking |
| 7 | Verify session JWT |

### Phase 3 — Request Context Integration (Future Task)

| Step | Description |
|---|---|
| 1 | Implement production request context resolver using Auth.js session |
| 2 | Map Auth.js authenticated user to internal User |
| 3 | Resolve tenant context from BusinessMembership |
| 4 | Replace dev auth adapter in production |
| 5 | Add session validation tests |

### Phase 4 — Production Hardening (Future Task)

| Step | Description |
|---|---|
| 1 | Secure cookie configuration |
| 2 | CSRF protection verification |
| 3 | Session rotation and expiry |
| 4 | Account linking policy enforcement |
| 5 | Suspended/deactivated user enforcement |
| 6 | Audit logging for auth events |
| 7 | Rate limiting for auth endpoints |
| 8 | Dev auth context rejection in production |

## Failure Modes

### Credential Validation Failures

| Failure | When | Behavior | Recovery |
|---|---|---|---|
| `AUTH_SECRET` missing/empty | Handler initialization | Throw Error, handler does not start | Set valid `AUTH_SECRET` in env, handler re-initializes on next request |
| `AUTH_GOOGLE_ID` missing/empty | Handler initialization | Throw Error, handler does not start | Set valid `AUTH_GOOGLE_ID` in env, handler re-initializes on next request |
| `AUTH_GOOGLE_SECRET` missing/empty | Handler initialization | Throw Error, handler does not start | Set valid `AUTH_GOOGLE_SECRET` in env, handler re-initializes on next request |

### OAuth Flow Failures

| Failure | When | Behavior | Recovery |
|---|---|---|---|
| Invalid client ID | OAuth redirect to Google | Google returns error page | Fix `AUTH_GOOGLE_ID`, retry |
| Invalid client secret | Token exchange (callback) | Auth.js returns OAuthCallbackError | Fix `AUTH_GOOGLE_SECRET`, retry |
| Mismatched redirect URI | OAuth callback | Google returns `redirect_uri_mismatch` | Register correct URI in Google Cloud Console |
| User denies consent | Google consent screen | Auth.js returns `access_denied` callback error | User must retry and grant consent |
| Google API down | OAuth flow | Auth.js returns provider error | Retry; no application-side fix possible |
| Network timeout | Token exchange | Auth.js returns timeout error | Retry |

### User Creation Failures

| Failure | When | Behavior | Recovery |
|---|---|---|---|
| Google profile missing email | User creation | Adapter wrapper throws `AuthjsMappingError` (required email) | Should not occur — Google always provides email. If it does, the error is logged and the auth flow fails. |
| Google profile missing name | User creation | Adapter wrapper uses fallback: email local-part → "User" | Automatic — no manual intervention needed |
| Database constraint violation | User creation (duplicate email) | Prisma throws unique constraint error | Auth.js should attempt account linking; if linking fails, error is returned |
| Database connection failure | Any DB operation | Prisma throws connection error | Application must retry or return 500 |

### Feature Flag Failures

| Failure | When | Behavior | Recovery |
|---|---|---|---|
| `ENABLE_AUTHJS_RUNTIME` not set | Any request | Returns 501 `AUTHJS_RUNTIME_DISABLED` | Set `ENABLE_AUTHJS_RUNTIME=true` |
| `ENABLE_AUTHJS_RUNTIME` set to non-`"true"` | Any request | Returns 501 `AUTHJS_RUNTIME_DISABLED` | Set exact string `"true"` |
| Flag disabled after being enabled | Any request | Returns 501 immediately, cached handlers not returned | Re-enable flag or leave disabled |

## Security Constraints

### Secret Management

- `AUTH_SECRET` must be a cryptographically random string of at least 32 characters.
- `AUTH_GOOGLE_SECRET` must not be committed to version control.
- All auth secrets must be set through environment variables, not hardcoded.
- `.env.local` (local development) must be in `.gitignore`.
- Production secrets must be set through the hosting platform's secret management.

### OAuth Security

- **PKCE (Proof Key for Code Exchange):** Auth.js v5 enables PKCE by default for OAuth providers that support it. Google supports PKCE.
- **State parameter:** Auth.js automatically generates and validates the OAuth state parameter to prevent CSRF attacks.
- **Nonce validation:** Auth.js handles nonce validation for OIDC flows.
- **HTTPS required:** Production callback URLs must use HTTPS. Google requires HTTPS for production redirect URIs.

### Session Security

- JWT strategy is enforced — no database session tokens.
- JWT is encrypted using `AUTH_SECRET`.
- JWT is stored in an HttpOnly, Secure, SameSite cookie by Auth.js.
- Session data is server-signed and encrypted — cannot be tampered with client-side.
- JWT expiry should be configured with reasonable defaults (Auth.js default: 30 days).

### User Security

- `User.status` must be checked after authentication — suspended/deactivated users must not receive active context.
- Provider profile data must not override internal `User.status`, `MembershipRole`, or `AuthzPermission`.
- Provider `image` URL is treated as untrusted external input.
- Account linking by email requires provider-verified email.
- Provider account ID must never become internal `User.id`.

### Environment Isolation

- `ENABLE_DEV_AUTH_CONTEXT` must be **prohibited** in production.
- Dev auth headers (`x-dev-*`) must not be accepted in production.
- `ENABLE_AUTHJS_RUNTIME` can be enabled/disabled independently per environment.
- Google OAuth credentials should be separate per environment (dev/staging/production).

### Callback URL Security

- Only registered callback URLs in Google Cloud Console are accepted.
- `AUTH_URL` / `NEXTAUTH_URL` must match the actual application URL.
- Open redirect protection is handled by Auth.js internally.

## Adapter Interaction

The accepted adapter wrapper (TASK-0032) handles provider data normalization at the boundary:

| Google Profile Field | Adapter Mapping | Internal User Field |
|---|---|---|
| `email` | Required — `normalizeAuthjsEmail()` | `User.email` |
| `name` | Fallback — `resolveAuthjsUserName()` | `User.name` |
| `picture` (Google) / `image` (Auth.js) | Map — `normalizeAuthjsImage()` | `User.avatarUrl` |
| `email_verified` | Pass-through | `User.emailVerified` |

No adapter changes are needed for provider configuration. The adapter already handles any provider's user profile data generically.

## Account Linking Behavior

When a user signs in with Google OAuth:

1. Auth.js checks if an `Account` record exists for `provider=google` + `providerAccountId={google-sub}`.
2. If yes → existing user session is returned.
3. If no → Auth.js checks if a `User` exists with the same email.
4. If User exists → creates `Account` record linking Google to existing User (account linking).
5. If User does not exist → creates new `User` (via adapter wrapper) + `Account` record.

**Security consideration for account linking:**

- Auth.js v5 default behavior links accounts by email if the email is verified.
- This is appropriate for Google OAuth because Google always provides verified email.
- For future providers that may not guarantee verified email, account linking policy must be reviewed.

## Files Created in This Task

- `docs/architecture/authjs-provider-environment-contract.md` — this file
- `docs/checkpoints/TASK-0035-authjs-provider-configuration-design-env-contract.md`

## Files NOT Modified

- `package.json` — no package changes
- `pnpm-lock.yaml` — no lockfile changes
- `prisma/schema.prisma` — no schema changes
- `prisma/migrations/*` — no migrations
- `src/app/api/auth/[...nextauth]/route.ts` — no route changes
- `src/lib/auth/*` — no auth module changes
- `__tests__/**` — no test changes
- `.env*` — no env file changes
- `middleware.ts` — no middleware
- UI — no UI changes

## Explicit Non-Goals

- No provider implementation
- No provider configuration in source code
- No provider secrets added to env
- No Google Cloud Console setup
- No OAuth flow testing
- No middleware
- No login/signup UI
- No callback routes (beyond existing catch-all)
- No schema changes
- No migrations
- No package changes
- No lockfile changes
- No env file changes
- No request-context resolver changes
- No domain service changes
- No existing API route changes
- No test changes
- No workflow changes

## Consequences

### Positive

- Clear provider contract defined before implementation.
- Environment variable naming follows Auth.js v5 convention.
- Validation rules are explicit and follow existing patterns.
- Rollout plan is incremental with clear phase boundaries.
- Failure modes are documented with recovery paths.
- Security constraints are explicitly stated.
- No code changes — pure design/documentation.

### Negative

- Google OAuth is not yet functional — still requires implementation task.
- Auth.js v5 is in beta (`5.0.0-beta.31`) — API surface may change.
- Google Cloud Console setup is deferred — requires manual setup step.
- Account linking policy for non-Google providers is deferred.

## Decision

Accepted Auth.js provider environment contract: Google OAuth as first provider, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET as required environment variables, validation follows existing AUTH_SECRET pattern, no new feature flag, kill switch semantics preserved, and implementation deferred to next task.

## Recommended Next Task

[Phase 2] TASK-0036: Auth.js Google OAuth provider wiring behind feature flag
