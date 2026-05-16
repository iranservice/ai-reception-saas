# Auth.js Request-Context Staging Rollout and Observability Plan

## Status

Documentation-only plan. No rollout performed.

## Objective

Define a safe staging rollout procedure for enabling Auth.js request-context resolution for protected API handlers. The rollout involves three progressive feature flags:

1. `ENABLE_AUTHJS_RUNTIME` — Auth.js route runtime
2. `ENABLE_AUTHJS_GOOGLE_PROVIDER` — Google OAuth provider
3. `ENABLE_AUTHJS_REQUEST_CONTEXT` — Auth.js-backed request-context adapter

## Non-Goals

This document is a plan only. The following are explicitly out of scope:

- No production rollout
- No middleware implementation
- No UI changes
- No runtime code changes
- No env file commits
- No logging or metrics code implementation
- No Prisma schema or migration changes
- No authz policy changes
- No tenant/JWT claim additions
- No feature flag changes

---

## Feature Flags

| Flag | Purpose | Default | Rollout Stage |
|---|---|---|---|
| `ENABLE_AUTHJS_RUNTIME` | Enables Auth.js route handlers at `/api/auth/*` | `off` | Stage 1 |
| `ENABLE_AUTHJS_GOOGLE_PROVIDER` | Enables Google OAuth provider configuration | `off` | Stage 2 |
| `ENABLE_AUTHJS_REQUEST_CONTEXT` | Selects Auth.js adapter for request-context resolution | `off` | Stage 3 |
| `ENABLE_API_HANDLERS` | Existing API handler gate (prerequisite) | existing | Prerequisite |
| `ENABLE_DEV_AUTH_CONTEXT` | Dev-header adapter fallback for testing | dev/test only | Must be disabled for Auth.js validation |

### Flag Strictness

All flags require the exact string `"true"` (case-sensitive, no trimming). Any other value — including `"TRUE"`, `"1"`, `"yes"`, `" true "` — is treated as disabled.

### Flag Dependencies

```
ENABLE_API_HANDLERS = "true"           ← prerequisite for all API handlers
  └── ENABLE_AUTHJS_RUNTIME = "true"   ← Stage 1: Auth.js route runtime
       └── ENABLE_AUTHJS_GOOGLE_PROVIDER = "true"  ← Stage 2: Google OAuth
       └── ENABLE_AUTHJS_REQUEST_CONTEXT = "true"   ← Stage 3: request-context adapter
```

When `ENABLE_AUTHJS_REQUEST_CONTEXT` is `"true"` but `ENABLE_AUTHJS_RUNTIME` is not, the adapter returns `AUTH_CONTEXT_UNAVAILABLE` 501 with message: `Auth.js runtime is not enabled. ENABLE_AUTHJS_REQUEST_CONTEXT requires ENABLE_AUTHJS_RUNTIME to also be enabled.`

When `ENABLE_AUTHJS_REQUEST_CONTEXT` is not `"true"`, the system falls back to the dev-header adapter (if `ENABLE_DEV_AUTH_CONTEXT` is `"true"`) or returns `AUTH_CONTEXT_UNAVAILABLE` 501.

---

## Required Environment Variables

| Variable | Required When | Semantics |
|---|---|---|
| `AUTH_SECRET` | `ENABLE_AUTHJS_RUNTIME=true` | JWT signing secret, ≥32 characters |
| `AUTH_GOOGLE_ID` | `ENABLE_AUTHJS_GOOGLE_PROVIDER=true` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | `ENABLE_AUTHJS_GOOGLE_PROVIDER=true` | Google OAuth client secret |
| `DATABASE_URL` | `ENABLE_AUTHJS_RUNTIME=true` | PostgreSQL connection (Prisma adapter) |
| `ENABLE_AUTHJS_RUNTIME` | Stage 1+ | Exact `"true"` to enable |
| `ENABLE_AUTHJS_GOOGLE_PROVIDER` | Stage 2+ | Exact `"true"` to enable |
| `ENABLE_AUTHJS_REQUEST_CONTEXT` | Stage 3 | Exact `"true"` to enable |
| `ENABLE_API_HANDLERS` | All stages | Existing prerequisite |
| `ENABLE_DEV_AUTH_CONTEXT` | N/A | Must be disabled (`false` or unset) for Auth.js validation |

> **IMPORTANT:** Do not commit environment files. Use platform-level environment configuration (Vercel, hosting dashboard, etc.) for staging. Use `.env.local` (gitignored) for local testing only.

---

## Pre-Rollout Checklist

### Code Readiness

- [ ] Main branch is up to date (latest after TASK-0041)
- [ ] All 7 checks passing: install, prisma:format, prisma:generate, typecheck, lint, test, build
- [ ] Protected handler smoke tests (TASK-0041) passing: 844+ tests
- [ ] No outstanding P0 blockers on the task board

### Infrastructure Readiness

- [ ] Database migration TASK-0031 applied in target environment
- [ ] `Account` table exists
- [ ] `VerificationToken` table exists
- [ ] `User.emailVerified` column exists
- [ ] PostgreSQL is accessible from staging environment

### Google OAuth Readiness

- [ ] Google Cloud project configured
- [ ] OAuth consent screen configured (scopes: email, profile, openid)
- [ ] OAuth 2.0 Client ID created for staging environment
- [ ] Authorized redirect URI matches staging callback URL:
      `https://<staging-domain>/api/auth/callback/google`
- [ ] Client ID and Client Secret stored securely in staging environment config
- [ ] Auth.js Google OAuth smoke test runbook (TASK-0037) completed locally

### Staging Data Readiness

- [ ] At least one staging test user exists in the `User` table
- [ ] At least one staging test business exists in the `Business` table
- [ ] Test user has an active `BusinessMembership` for the test business
- [ ] Membership role is known (OWNER/ADMIN/OPERATOR/VIEWER)

### Operational Readiness

- [ ] Rollback owner assigned (person responsible for disabling flags if issues occur)
- [ ] Application logs access confirmed for staging environment
- [ ] Incident communication channel identified (Slack, Teams, etc.)
- [ ] Rollback procedure reviewed and understood by rollback owner

---

## Rollout Stages

### Stage 0 — Baseline (Current State)

**Flags:**

```env
ENABLE_AUTHJS_RUNTIME=false
ENABLE_AUTHJS_GOOGLE_PROVIDER=false
ENABLE_AUTHJS_REQUEST_CONTEXT=false
ENABLE_API_HANDLERS=true
ENABLE_DEV_AUTH_CONTEXT=false
```

**Expected behavior:**

- `/api/auth/*` returns 501 `AUTHJS_RUNTIME_DISABLED`
- Protected handlers use dev-header fallback only if `ENABLE_DEV_AUTH_CONTEXT=true`
- No Auth.js session resolution
- No Google OAuth

**Validation:**

```bash
curl -s https://<staging>/api/auth/session | jq .
# Expect: { "ok": false, "error": { "code": "AUTHJS_RUNTIME_DISABLED" } }
# HTTP 501
```

---

### Stage 1 — Enable Auth.js Runtime

**Flag change:**

```env
ENABLE_AUTHJS_RUNTIME=true
```

**Additional env required:**

```env
AUTH_SECRET=<staging-secret-at-least-32-chars>
```

**Expected behavior:**

- `/api/auth/session` returns Auth.js session response (null session if not signed in)
- `/api/auth/signin` shows Auth.js default sign-in page (no providers listed yet)
- No Google OAuth flow available
- Protected handlers unchanged (request-context not switched)

**Validation:**

```bash
# Session endpoint responds (not 501)
curl -s -o /dev/null -w "%{http_code}" https://<staging>/api/auth/session
# Expect: 200

# Signin page loads
curl -s -o /dev/null -w "%{http_code}" https://<staging>/api/auth/signin
# Expect: 200
```

**Rollback:** Set `ENABLE_AUTHJS_RUNTIME=false`. Auth.js routes return 501.

---

### Stage 2 — Enable Google OAuth Provider

**Flag change:**

```env
ENABLE_AUTHJS_GOOGLE_PROVIDER=true
```

**Additional env required:**

```env
AUTH_GOOGLE_ID=<staging-google-client-id>
AUTH_GOOGLE_SECRET=<staging-google-client-secret>
```

**Expected behavior:**

- `/api/auth/signin` shows Google sign-in button
- Google OAuth flow works end-to-end (consent → callback → session)
- Session contains user data after sign-in (`session.user.id`, `.email`, `.name`)
- User record created in database via Prisma adapter
- Protected handlers still unchanged (request-context not switched)

**Validation:**

1. Navigate to `https://<staging>/api/auth/signin`
2. Click Google sign-in
3. Complete OAuth consent flow
4. Verify session:

```bash
# With session cookie from browser
curl -s -b "<session-cookie>" https://<staging>/api/auth/session | jq .
# Expect: { "user": { "id": "...", "email": "...", "name": "..." }, "expires": "..." }
```

**Rollback:** Set `ENABLE_AUTHJS_GOOGLE_PROVIDER=false`. Google sign-in disappears. Existing sessions remain valid until expiry.

---

### Stage 3 — Enable Auth.js Request-Context

**Precondition:** Ensure `ENABLE_DEV_AUTH_CONTEXT` is not `"true"` during validation. If it was previously enabled, disable it first:

```env
ENABLE_DEV_AUTH_CONTEXT=false
```

**Flag change:**

```env
ENABLE_AUTHJS_REQUEST_CONTEXT=true
```

**Expected behavior:**

- Protected handlers now resolve request context from Auth.js JWT session
- Authenticated context uses `session.user.id` (from `token.sub`)
- Tenant context uses route-param `businessId` (preferred) or `x-business-id` header (fallback)
- Tenant membership lookup via `TenancyService.resolveTenantContext`
- System context remains deferred (returns `AUTH_CONTEXT_UNAVAILABLE` 501)

**Error contract:**

| Condition | Error Code | HTTP Status |
|---|---|---|
| Auth.js infrastructure failure | `AUTH_CONTEXT_UNAVAILABLE` | 501 |
| No session (not signed in) | `UNAUTHENTICATED` | 401 |
| Missing/empty `session.user.id` | `INVALID_AUTH_CONTEXT` | 400 |
| Missing/blank business scope | `TENANT_CONTEXT_REQUIRED` | 403 |
| No active membership | `ACCESS_DENIED` | 403 |

**Validation — authenticated context:**

```bash
# Without session → 401
curl -s -o /dev/null -w "%{http_code}" https://<staging>/api/businesses
# Expect: 401

# With valid session cookie → 200
curl -s -b "<session-cookie>" https://<staging>/api/businesses | jq .
# Expect: 200 with business list
```

**Validation — tenant context (route-param):**

```bash
# With valid session + route-param businessId → 200
curl -s -b "<session-cookie>" https://<staging>/api/businesses/<business-id> | jq .
# Expect: 200 with business detail (if user has membership)

# With valid session + wrong businessId → 403
curl -s -b "<session-cookie>" https://<staging>/api/businesses/<unknown-id> | jq .
# Expect: 403 ACCESS_DENIED (no membership)
```

**Validation — tenant context (header fallback):**

```bash
# Authz evaluate with x-business-id header → 200
curl -s -b "<session-cookie>" \
  -H "x-business-id: <business-id>" \
  -H "Content-Type: application/json" \
  -d '{"permission":"business.read"}' \
  https://<staging>/api/authz/evaluate | jq .
# Expect: 200 with allowed: true/false
```

**Validation — kill-switch:**

```bash
# Set ENABLE_AUTHJS_REQUEST_CONTEXT=false, restart
# Protected handlers should return 501 AUTH_CONTEXT_UNAVAILABLE
# (unless ENABLE_DEV_AUTH_CONTEXT is re-enabled)
```

**Rollback:** Set `ENABLE_AUTHJS_REQUEST_CONTEXT=false`. Protected handlers fall back to dev-header adapter (if enabled) or return 501. Auth.js route handlers (`/api/auth/*`) remain functional.

---

## Observability Plan

### What to Monitor

| Signal | What to Look For | Severity |
|---|---|---|
| HTTP 501 on protected handlers | `AUTH_CONTEXT_UNAVAILABLE` — indicates Auth.js init failure or flag misconfiguration | P1 |
| HTTP 401 increase | `UNAUTHENTICATED` — session not present, may indicate cookie/domain issues | P2 |
| HTTP 400 on protected handlers | `INVALID_AUTH_CONTEXT` — session exists but user.id missing, indicates JWT callback issue | P1 |
| HTTP 403 increase | `TENANT_CONTEXT_REQUIRED` or `ACCESS_DENIED` — business scope or membership issues | P2 |
| Auth.js callback errors | Errors in `/api/auth/callback/google` — OAuth flow failures | P1 |
| Database connection errors | Prisma adapter failures during session/account operations | P0 |
| JWT decode errors | Auth.js unable to decode/verify JWT — AUTH_SECRET mismatch or rotation | P0 |

### How to Monitor (Staging)

Since no runtime logging/metrics code is implemented, use:

1. **Application logs** — Review server-side console output for error stack traces and Auth.js debug messages.
2. **HTTP response codes** — Observe responses from protected endpoints using curl, browser DevTools, or API clients.
3. **Database state** — Query `Account`, `User`, and `Session` tables directly to verify records are created after OAuth flow.
4. **Manual testing** — Follow validation steps in each rollout stage above.

### Future Observability Tasks (Not in Scope)

The following should be implemented in future tasks:

- Structured request-context error logging (error code, userId, businessId, source)
- Metrics/counters for context resolution outcomes (success/unauth/denied/unavailable)
- Alert rules for P0/P1 error rate thresholds
- Auth.js debug mode toggle for staging diagnostics
- Distributed tracing integration

---

## Rollback Procedure

### Immediate Rollback (Any Stage)

1. Set the highest-stage flag back to `false`:
   - Stage 3: `ENABLE_AUTHJS_REQUEST_CONTEXT=false`
   - Stage 2: `ENABLE_AUTHJS_GOOGLE_PROVIDER=false`
   - Stage 1: `ENABLE_AUTHJS_RUNTIME=false`
2. Redeploy or restart the application.
3. Verify the expected fallback behavior using the validation steps in Stage 0.
4. Notify the team via the incident channel.

### Rollback Impact

| Flag Disabled | Impact |
|---|---|
| `ENABLE_AUTHJS_REQUEST_CONTEXT=false` | Protected handlers return 501 or fall back to dev-header adapter. Auth.js OAuth flows still work. |
| `ENABLE_AUTHJS_GOOGLE_PROVIDER=false` | Google sign-in disappears. Existing JWT sessions remain valid until expiry. |
| `ENABLE_AUTHJS_RUNTIME=false` | All `/api/auth/*` routes return 501. No new sessions can be created. Existing JWTs expire naturally. |

### Data Impact

- **No data loss** from disabling any flag. User, Account, and BusinessMembership records remain in the database.
- **Existing JWT sessions** expire naturally (per Auth.js session maxAge).
- **No migration rollback** needed — flags are runtime-only.

---

## Scope Boundaries

### What This Plan Covers

- Feature flag rollout order and dependencies
- Environment variable requirements
- Pre-rollout checklist
- Validation steps per stage
- Error contract reference
- Observability guidance
- Rollback procedure

### What This Plan Does NOT Cover

- Production rollout
- Tenant picker / workspace switcher UI
- System request-context resolver
- Middleware implementation
- Auth.js session database persistence strategy
- Rate limiting or abuse protection
- Multi-provider (beyond Google) rollout
- Custom sign-in/sign-out pages

---

## References

| Resource | Path |
|---|---|
| Auth.js request-context resolver design | `docs/architecture/authjs-request-context-resolver-design.md` |
| Google OAuth smoke test runbook | `docs/operations/authjs-google-oauth-smoke-test-runbook.md` |
| TASK-0038 design checkpoint | `docs/checkpoints/TASK-0038-authjs-request-context-resolver-design.md` |
| TASK-0039 authenticated resolver checkpoint | `docs/checkpoints/TASK-0039-authjs-authenticated-request-context-resolver.md` |
| TASK-0040 tenant resolver checkpoint | `docs/checkpoints/TASK-0040-authjs-tenant-request-context-resolver.md` |
| TASK-0041 smoke tests checkpoint | `docs/checkpoints/TASK-0041-authjs-request-context-protected-handler-smoke-tests.md` |
| Auth.js adapter source | `src/app/api/_shared/authjs-context-adapter.ts` |
| Auth-context adapter source | `src/app/api/_shared/auth-context-adapter.ts` |
| Auth.js runtime source | `src/lib/auth/authjs-runtime.ts` |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-16 | Initial plan — TASK-0042 |
