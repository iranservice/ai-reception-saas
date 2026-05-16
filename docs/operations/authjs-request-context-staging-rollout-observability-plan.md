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

### Stage 4 — Staging Soak

**Duration:** 24–72 hours.

**Flags:** Same as Stage 3 (all three flags enabled).

```env
ENABLE_AUTHJS_RUNTIME=true
ENABLE_AUTHJS_GOOGLE_PROVIDER=true
ENABLE_AUTHJS_REQUEST_CONTEXT=true
ENABLE_DEV_AUTH_CONTEXT=false
```

**Expected behavior:**

- Auth.js runtime remains enabled.
- Google provider remains enabled.
- Auth.js request-context remains enabled.
- Protected handlers continue to use Auth.js session and explicit tenant scope.
- No dev-header dependency.

**Monitor:**

- Auth error rates (501/401/400/403 on protected handlers)
- Session read failures
- Tenant membership lookup failures
- Google OAuth callback failures
- Account linking failures
- Protected handler latency
- Tenancy resolver latency

**Exit criteria:**

- [ ] No sustained increase in 5xx error rate
- [ ] No unexplained tenant context failures
- [ ] No unexplained OAuth callback error spike
- [ ] Protected handler smoke tests remain green
- [ ] Manual validation checklist completed (see below)
- [ ] Rollback path verified (flag disable → confirm fallback behavior)

**Rollback:** Same as Stage 3 — set `ENABLE_AUTHJS_REQUEST_CONTEXT=false`.

---

## Observability Plan

### What to Monitor

| Signal | What to Look For | Severity |
|---|---|---|
| HTTP 501 on protected handlers | `AUTH_CONTEXT_UNAVAILABLE` — Auth.js init failure or flag misconfiguration | P1 |
| HTTP 401 increase | `UNAUTHENTICATED` — session not present, cookie/domain issues | P2 |
| HTTP 400 on protected handlers | `INVALID_AUTH_CONTEXT` — session exists but user.id missing, JWT callback issue | P1 |
| HTTP 403 increase | `TENANT_CONTEXT_REQUIRED` or `ACCESS_DENIED` — business scope or membership issues | P2 |
| Auth.js callback errors | Errors in `/api/auth/callback/google` — OAuth flow failures | P1 |
| Database connection errors | Prisma adapter failures during session/account operations | P0 |
| JWT decode errors | Auth.js unable to decode/verify JWT — AUTH_SECRET mismatch or rotation | P0 |

### Structured Logs (Recommended — Not Yet Implemented)

When logging is implemented in a future task, each request-context resolution should emit a structured log entry:

```json
{
  "event": "request_context_resolved",
  "adapter": "authjs",
  "outcome": "success | unauthenticated | invalid_auth | tenant_required | access_denied | unavailable",
  "userId": "<redacted-uuid or null>",
  "businessId": "<uuid or null>",
  "scopeSource": "route-param | header | none",
  "durationMs": 12,
  "errorCode": "<error code or null>",
  "httpStatus": 200,
  "path": "/api/businesses/:businessId",
  "timestamp": "2026-05-16T12:00:00.000Z"
}
```

> **NOTE:** This is the recommended log schema. No logging code exists yet. This section defines the target contract for the future implementation task.

### Metrics (Recommended — Not Yet Implemented)

When metrics are implemented, the following counters and histograms should be tracked:

| Metric Name | Type | Labels | Purpose |
|---|---|---|---|
| `authjs_context_resolution_total` | Counter | `outcome`, `adapter`, `scope_source` | Total context resolution attempts |
| `authjs_context_resolution_errors_total` | Counter | `error_code`, `http_status` | Error breakdown by code |
| `authjs_context_resolution_duration_ms` | Histogram | `outcome`, `adapter` | Latency distribution |
| `authjs_session_read_duration_ms` | Histogram | `outcome` | Auth.js session read latency |
| `authjs_tenant_membership_lookup_duration_ms` | Histogram | `outcome` | Tenancy service lookup latency |
| `authjs_oauth_callback_total` | Counter | `provider`, `outcome` | OAuth callback success/failure |

### Dashboards (Recommended — Not Yet Implemented)

When a dashboard is created, it should include:

1. **Auth.js Context Resolution** — success/failure rates by outcome, broken down by adapter and scope source.
2. **Auth Error Rates** — 401/400/403/501 rates over time on protected handler paths.
3. **Auth.js Session Performance** — session read latency p50/p95/p99.
4. **Tenant Resolution Performance** — membership lookup latency p50/p95/p99.
5. **OAuth Flow Health** — callback success/failure rates by provider.
6. **Rollout Safety** — before/after comparison of error rates across rollout stages.

### Alerts (Recommended — Not Yet Implemented)

When alerting is implemented, the following rules should be configured:

| Alert | Condition | Severity | Action |
|---|---|---|---|
| Auth.js context 5xx spike | `authjs_context_resolution_errors_total{http_status=~"5.."} > 5/min` for 5 minutes | P0 | Page rollback owner, rollback Stage 3 |
| JWT decode failures | Any `JWT decode error` log entry | P0 | Check AUTH_SECRET, rollback if mismatch |
| Database connection failures | Prisma connection errors > 0 for 2 minutes | P0 | Check DATABASE_URL, verify PostgreSQL health |
| OAuth callback failure rate | Callback error rate > 20% over 10 minutes | P1 | Check Google Cloud Console, verify credentials |
| Unauthenticated spike | 401 rate increase > 3x baseline over 15 minutes | P2 | Check cookie domain, JWT expiry settings |
| Tenant context denied spike | 403 rate increase > 3x baseline over 15 minutes | P2 | Check membership data, business scope logic |

### How to Monitor (Staging — Current)

Since no runtime logging/metrics code is implemented, use:

1. **Application logs** — Review server-side console output for error stack traces and Auth.js debug messages.
2. **HTTP response codes** — Observe responses from protected endpoints using curl, browser DevTools, or API clients.
3. **Database state** — Query `Account`, `User`, and `Session` tables directly to verify records are created after OAuth flow.
4. **Manual testing** — Follow validation steps in each rollout stage and the Manual Validation Checklist below.

### Future Observability Tasks (Not in Scope)

The following should be implemented in future tasks:

- Structured request-context error logging (schema defined above)
- Metrics/counters for context resolution outcomes (metrics table above)
- Dashboard creation (panels defined above)
- Alert rules for P0/P1 error rate thresholds (alert table above)
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

## Failure Mode Matrix

| Failure Mode | Symptom | Root Cause | Detection | Mitigation |
|---|---|---|---|---|
| AUTH_SECRET mismatch | All sessions invalid, 401 on every request | AUTH_SECRET changed or rotated without session invalidation | JWT decode errors in logs, 100% 401 rate | Restore previous AUTH_SECRET or wait for session expiry |
| Google credentials invalid | OAuth flow returns error, callback 500 | AUTH_GOOGLE_ID or AUTH_GOOGLE_SECRET wrong/expired | Callback error logs, Google Cloud Console alerts | Regenerate credentials in Google Cloud Console |
| Database unreachable | Account creation fails, 500 on callback | DATABASE_URL wrong or PostgreSQL down | Prisma connection error logs, Account table empty | Fix DATABASE_URL, restore PostgreSQL |
| Missing Account/User tables | Runtime crash on first OAuth callback | Migration TASK-0031 not applied | Server startup errors, 500 on auth routes | Apply migration: `pnpm prisma:migrate` |
| Flag dependency violation | 501 AUTH_CONTEXT_UNAVAILABLE on all protected handlers | ENABLE_AUTHJS_REQUEST_CONTEXT=true but ENABLE_AUTHJS_RUNTIME≠true | 100% 501 rate on protected handlers | Enable ENABLE_AUTHJS_RUNTIME=true |
| Cookie domain mismatch | Session not sent to API, 401 on protected handlers | Staging domain does not match cookie domain | Session cookie missing in request headers | Check AUTH_URL or NEXTAUTH_URL matches staging domain |
| Membership data missing | 403 ACCESS_DENIED on all tenant-scoped requests | Test user has no active BusinessMembership | All tenant requests return 403 | Create active membership for test user |
| Redirect URI mismatch | Google returns redirect_uri_mismatch error | Staging callback URL not in Google OAuth allowed list | OAuth error page, no callback reached | Add staging callback URL to Google Cloud Console |

---

## Manual Validation Checklist

Complete this checklist after each rollout stage and during the staging soak.

### Authentication Flow

- [ ] Visit `/api/auth/session` without session → returns null/empty session
- [ ] Visit `/api/auth/signin` → shows sign-in page with Google button (Stage 2+)
- [ ] Complete Google OAuth flow → redirected to callback, no errors
- [ ] Visit `/api/auth/session` with session → returns user data (id, email, name)
- [ ] Visit `/api/auth/signout` → session cleared
- [ ] Verify User record created in database after first sign-in
- [ ] Verify Account record created in database (links Google provider)

### Protected Handler — Authenticated Context

- [ ] GET `/api/businesses` without session → 401 UNAUTHENTICATED
- [ ] GET `/api/businesses` with valid session → 200 (authenticated context works)

### Protected Handler — Tenant Context (Route Param)

- [ ] GET `/api/businesses/<valid-id>` with session + membership → 200
- [ ] GET `/api/businesses/<unknown-id>` with session → 403 ACCESS_DENIED
- [ ] GET `/api/businesses/<valid-id>/memberships` → 200 (tenant scope from route param)
- [ ] GET `/api/businesses/<valid-id>/audit-events` → 200 (audit.read authorized)

### Protected Handler — Tenant Context (Header Fallback)

- [ ] POST `/api/authz/evaluate` with `x-business-id` header → 200
- [ ] POST `/api/authz/evaluate` without `x-business-id` header → 403 TENANT_CONTEXT_REQUIRED

### Kill-Switch Verification

- [ ] Set `ENABLE_AUTHJS_REQUEST_CONTEXT=false`, restart → protected handlers return 501
- [ ] Set `ENABLE_AUTHJS_REQUEST_CONTEXT=true`, restart → protected handlers work again
- [ ] Set `ENABLE_AUTHJS_RUNTIME=false`, restart → `/api/auth/*` returns 501

### Negative Cases

- [ ] Expired session cookie → 401 UNAUTHENTICATED
- [ ] Malformed `x-business-id` header (whitespace only) → 403 TENANT_CONTEXT_REQUIRED
- [ ] Route-param businessId with no membership → 403 ACCESS_DENIED

---

## Data Safety

### Data Created During Rollout

| Table | Records Created | Rollback Impact |
|---|---|---|
| `User` | New user on first OAuth sign-in | Records remain after rollback. No deletion needed. |
| `Account` | Google provider link per user | Records remain. Re-linking occurs on next sign-in if re-enabled. |
| `VerificationToken` | None (not used with OAuth flow) | N/A |
| `Business` | None (created via API, not auth) | N/A |
| `BusinessMembership` | None (created via API, not auth) | N/A |

### Data Integrity Guarantees

- **No data loss** from disabling any flag. All User, Account, and BusinessMembership records remain intact.
- **No orphaned records.** Account records link to User via foreign key.
- **No schema rollback** needed — flags are runtime-only, no migration changes.
- **JWT sessions** expire naturally per `session.maxAge`. No server-side session table to clean up (JWT strategy).

---

## Exit Criteria

The staging rollout is considered successful when ALL of the following are true:

### Must-Have (Blocking)

- [ ] All 4 rollout stages completed without rollback
- [ ] Stage 4 soak period (24–72 hours) completed
- [ ] No sustained 5xx error rate increase
- [ ] No unexplained tenant context failures
- [ ] No unexplained OAuth callback failures
- [ ] Manual validation checklist 100% completed
- [ ] Kill-switch rollback verified (flag disable → confirm fallback)
- [ ] Protected handler smoke tests (TASK-0041) green on main

### Should-Have (Non-Blocking)

- [ ] At least 2 distinct test users completed full OAuth + protected handler flow
- [ ] At least 2 distinct business memberships tested (different roles)
- [ ] Session expiry and re-authentication tested
- [ ] Rollback owner confirmed recovery within 5 minutes

### Nice-to-Have

- [ ] Auth.js debug logging reviewed for unexpected warnings
- [ ] Database query count during context resolution observed (no N+1)
- [ ] Response time baseline established for protected handlers

---

## Open Questions

| # | Question | Impact | Owner |
|---|---|---|---|
| 1 | What is the staging domain / hosting platform? | Required to configure Google OAuth redirect URI and cookie domain | Ops |
| 2 | Is AUTH_URL / NEXTAUTH_URL needed for the staging deployment? | Auth.js may require explicit URL in non-localhost environments | Dev |
| 3 | What is the desired session maxAge for staging? | Affects how long sessions persist between soak validations | CTO |
| 4 | Should staging use a separate Google Cloud project / OAuth client? | Security isolation between staging and production | CTO |
| 5 | Is there an existing logging/APM platform for staging? | Determines whether structured logs and metrics can be observed | Ops |
| 6 | Who is the rollback owner for the staging rollout? | Required before Stage 1 can begin | CTO |
| 7 | When should production rollout planning begin? | Depends on soak results and exit criteria | CTO |

---

## Scope Boundaries

### What This Plan Covers

- Feature flag rollout order and dependencies
- Environment variable requirements
- Pre-rollout checklist
- Validation steps per stage (including Stage 4 soak)
- Error contract reference
- Failure mode matrix
- Observability guidance (current + recommended future)
- Manual validation checklist
- Data safety assessment
- Exit criteria
- Rollback procedure
- Open questions

### What This Plan Does NOT Cover

- Production rollout
- Tenant picker / workspace switcher UI
- System request-context resolver
- Middleware implementation
- Auth.js session database persistence strategy
- Rate limiting or abuse protection
- Multi-provider (beyond Google) rollout
- Custom sign-in/sign-out pages
- Logging/metrics code implementation

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
| 1.1 | 2026-05-16 | Added Stage 4 soak, failure mode matrix, expanded observability, manual validation checklist, data safety, exit criteria, open questions |
