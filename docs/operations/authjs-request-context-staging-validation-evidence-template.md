# Auth.js Request-Context Staging Validation Evidence Template

## Status

Template only. No validation executed.

## Purpose

Provide a structured evidence capture document for validating Auth.js request-context in staging. Operators duplicate this template before use and fill in every section during staging rollout validation.

## Instructions For Operators

1. **Duplicate** this template before use — do not edit the original.
2. **Fill in every section** during staging rollout validation.
3. **Attach evidence** — screenshots, log excerpts, HTTP responses — where applicable.
4. **Do not paste secrets** — never include `AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, session cookies, JWTs, OAuth access/refresh/id tokens, or full session payloads.
5. **Redact sensitive identifiers** if required by policy (see Redaction Policy below).
6. **Record exact timestamps** and operator names for every action.
7. **Record feature flag state** for every stage.
8. **Record rollback readiness** before enabling request-context (Stage 3).
9. **Sign off** at the bottom when validation is complete.

---

## Validation Metadata

| Field | Value |
|---|---|
| Validation Date | TBD |
| Environment | staging |
| Staging URL | TBD |
| Git Commit SHA | TBD |
| App Version / Deployment ID | TBD |
| Operator | TBD |
| Reviewer | TBD |
| Rollback Owner | TBD |
| Incident Channel | TBD |
| Database Migration TASK-0031 Applied | TBD |
| Google OAuth App / Client ID Label | TBD |
| Test User ID | TBD |
| Test User Email | redacted |
| Test Business ID | TBD |
| Test Membership ID | TBD |
| Test Membership Role | TBD |

---

## Redaction Policy

The following must **never** appear in this document or any attached evidence:

- `AUTH_SECRET` value
- `AUTH_GOOGLE_SECRET` / `GOOGLE_CLIENT_SECRET` value
- Session cookies (e.g., `next-auth.session-token`)
- JWT token values
- OAuth access tokens, refresh tokens, or ID tokens
- Full session object payloads
- Provider callback codes or state parameters

The following **may** be recorded if policy permits:

- `userId` (UUID)
- `businessId` (UUID)
- `membershipId` (UUID)
- `AUTH_GOOGLE_ID` / Client ID label (not the full secret)

The following must be **redacted or partially masked**:

- Email addresses (e.g., `j***@example.com`)
- User names (if PII policy requires)

Screenshots must:

- Hide browser cookie panels
- Hide request headers containing session tokens
- Hide response bodies containing full JWT payloads

---

## Pre-Rollout Readiness Evidence

### Code Readiness

| Check | Result | Notes |
|---|---|---|
| Main branch up to date | ☐ | Commit SHA: |
| `pnpm install` | ☐ | |
| `pnpm prisma:format` | ☐ | |
| `pnpm prisma:generate` | ☐ | |
| `pnpm typecheck` | ☐ | |
| `pnpm lint` | ☐ | Errors: / Warnings: |
| `pnpm test` | ☐ | Passed: / Skipped: |
| `pnpm build` | ☐ | |
| No P0 blockers | ☐ | |

### Infrastructure Readiness

| Check | Result | Notes |
|---|---|---|
| Migration TASK-0031 applied | ☐ | |
| `Account` table exists | ☐ | |
| `VerificationToken` table exists | ☐ | |
| `User.emailVerified` column exists | ☐ | |
| PostgreSQL accessible from staging | ☐ | |

### Google OAuth Readiness

| Check | Result | Notes |
|---|---|---|
| Google Cloud project configured | ☐ | Project: |
| OAuth consent screen configured | ☐ | Scopes: email, profile, openid |
| OAuth Client ID created for staging | ☐ | Label: |
| Redirect URI configured | ☐ | URI: `https://<staging>/api/auth/callback/google` |
| Client ID in staging env | ☐ | |
| Client Secret in staging env | ☐ | |
| Smoke test runbook (TASK-0037) completed locally | ☐ | |

### Staging Data Readiness

| Check | Result | Notes |
|---|---|---|
| Test user exists in `User` table | ☐ | User ID: |
| Test business exists in `Business` table | ☐ | Business ID: |
| Test user has active `BusinessMembership` | ☐ | Membership ID: |
| Membership role known | ☐ | Role: |

### Operational Readiness

| Check | Result | Notes |
|---|---|---|
| Rollback owner assigned | ☐ | Name: |
| Application logs access confirmed | ☐ | Platform: |
| Incident channel identified | ☐ | Channel: |
| Rollback procedure reviewed | ☐ | |

---

## Stage 0 — Baseline Evidence

**Timestamp:** TBD

**Flags:**

```env
ENABLE_AUTHJS_RUNTIME=false
ENABLE_AUTHJS_GOOGLE_PROVIDER=false
ENABLE_AUTHJS_REQUEST_CONTEXT=false
ENABLE_API_HANDLERS=true
ENABLE_DEV_AUTH_CONTEXT=false
```

### Validation

| Test | Expected | Actual | Pass |
|---|---|---|---|
| `GET /api/auth/session` | 501 `AUTHJS_RUNTIME_DISABLED` | | ☐ |
| Protected handler without dev-header | 501 `AUTH_CONTEXT_UNAVAILABLE` | | ☐ |

### Evidence

```
# Paste curl output or HTTP response (redacted)
```

### Notes

TBD

---

## Stage 1 — Auth.js Runtime Evidence

**Timestamp:** TBD

**Flag change:** `ENABLE_AUTHJS_RUNTIME=true`

**Additional env set:** `AUTH_SECRET` (not pasted)

### Validation

| Test | Expected | Actual | Pass |
|---|---|---|---|
| `GET /api/auth/session` | 200 (null/empty session) | | ☐ |
| `GET /api/auth/signin` | 200 (sign-in page, no providers) | | ☐ |
| Protected handlers unchanged | Same as Stage 0 | | ☐ |
| No errors in application logs | Clean startup | | ☐ |

### Evidence

```
# Paste curl output or HTTP response (redacted)
```

### Notes

TBD

---

## Stage 2 — Google OAuth Provider Evidence

**Timestamp:** TBD

**Flag change:** `ENABLE_AUTHJS_GOOGLE_PROVIDER=true`

**Additional env set:** `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (not pasted)

### Validation

| Test | Expected | Actual | Pass |
|---|---|---|---|
| `GET /api/auth/signin` | 200 (Google button visible) | | ☐ |
| Click Google sign-in | Redirects to Google consent | | ☐ |
| Complete OAuth flow | Redirects to callback, no errors | | ☐ |
| `GET /api/auth/session` (with cookie) | 200 with user data (id, email, name) | | ☐ |
| User record in database | Created | | ☐ |
| Account record in database | Created (Google provider) | | ☐ |
| Protected handlers unchanged | Same as Stage 0/1 | | ☐ |
| No secrets in application logs | Verified | | ☐ |

### Evidence

```
# Paste curl output or HTTP response (redacted)
# Paste DB query result for User/Account (redacted)
```

### Notes

TBD

---

## Stage 3 — Auth.js Request-Context Evidence

**Timestamp:** TBD

**Precondition confirmed:** `ENABLE_DEV_AUTH_CONTEXT=false` ☐

**Flag change:** `ENABLE_AUTHJS_REQUEST_CONTEXT=true`

**Rollback readiness confirmed:** ☐

### Validation — Authenticated Context

| Test | Expected | Actual | Pass |
|---|---|---|---|
| `GET /api/businesses` without session | 401 `UNAUTHENTICATED` | | ☐ |
| `GET /api/businesses` with valid session | 200 (authenticated context) | | ☐ |

### Validation — Tenant Context (Route Param)

| Test | Expected | Actual | Pass |
|---|---|---|---|
| `GET /api/businesses/<valid-id>` with membership | 200 | | ☐ |
| `GET /api/businesses/<unknown-id>` | 403 `ACCESS_DENIED` | | ☐ |
| `GET /api/businesses/<valid-id>/memberships` | 200 | | ☐ |
| `GET /api/businesses/<valid-id>/audit-events` | 200 | | ☐ |

### Validation — Tenant Context (Header Fallback)

| Test | Expected | Actual | Pass |
|---|---|---|---|
| `POST /api/authz/evaluate` with `x-business-id` header | 200 | | ☐ |
| `POST /api/authz/evaluate` without `x-business-id` header | 403 `TENANT_CONTEXT_REQUIRED` | | ☐ |

### Validation — Negative Cases

| Test | Expected | Actual | Pass |
|---|---|---|---|
| Empty `session.user.id` (if reproducible) | 400 `INVALID_AUTH_CONTEXT` | | ☐ |
| Expired session cookie | 401 `UNAUTHENTICATED` | | ☐ |
| Malformed `x-business-id` (whitespace) | 403 `TENANT_CONTEXT_REQUIRED` | | ☐ |
| Route-param businessId with no membership | 403 `ACCESS_DENIED` | | ☐ |

### Validation — Kill-Switch

| Test | Expected | Actual | Pass |
|---|---|---|---|
| Set `ENABLE_AUTHJS_REQUEST_CONTEXT=false`, restart | Protected handlers return 501 | | ☐ |
| Set `ENABLE_AUTHJS_REQUEST_CONTEXT=true`, restart | Protected handlers work again | | ☐ |
| Set `ENABLE_AUTHJS_RUNTIME=false`, restart | `/api/auth/*` returns 501 | | ☐ |

### Evidence

```
# Paste curl output or HTTP response (redacted) for each validation
```

### Notes

TBD

---

## Stage 4 — Staging Soak Evidence

**Soak start timestamp:** TBD

**Soak end timestamp:** TBD

**Soak duration:** TBD (target: 24–72 hours)

**Flags:** All three enabled, `ENABLE_DEV_AUTH_CONTEXT=false`

### Monitoring Log

| Timestamp | Signal | Observation | Severity | Action Taken |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

### Soak Exit Criteria

| Criterion | Met | Notes |
|---|---|---|
| No sustained 5xx error rate increase | ☐ | |
| No unexplained tenant context failures | ☐ | |
| No unexplained OAuth callback error spike | ☐ | |
| Protected handler smoke tests green | ☐ | |
| Manual validation checklist completed | ☐ | |
| Rollback path verified | ☐ | |

### Evidence

```
# Paste log excerpts, error rate summaries, or monitoring output (redacted)
```

### Notes

TBD

---

## Exit Criteria Summary

### Must-Have (Blocking)

| Criterion | Met | Evidence |
|---|---|---|
| All 4 rollout stages completed without rollback | ☐ | |
| Stage 4 soak period (24–72 hours) completed | ☐ | |
| No sustained 5xx error rate increase | ☐ | |
| No unexplained tenant context failures | ☐ | |
| No unexplained OAuth callback failures | ☐ | |
| Manual validation checklist 100% completed | ☐ | |
| Kill-switch rollback verified | ☐ | |
| Protected handler smoke tests green on main | ☐ | |

### Should-Have (Non-Blocking)

| Criterion | Met | Evidence |
|---|---|---|
| At least 2 distinct test users completed full flow | ☐ | |
| At least 2 distinct business memberships tested | ☐ | |
| Session expiry and re-authentication tested | ☐ | |
| Rollback owner confirmed recovery within 5 minutes | ☐ | |

### Nice-to-Have

| Criterion | Met | Evidence |
|---|---|---|
| Auth.js debug logging reviewed for warnings | ☐ | |
| Database query count observed (no N+1) | ☐ | |
| Response time baseline established | ☐ | |

---

## Failure Modes Encountered

Record any failures encountered during validation. Reference the Failure Mode Matrix in TASK-0042 rollout plan.

| # | Failure Mode | Stage | Timestamp | Symptom | Root Cause | Resolution | Duration |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
| | | | | | | | |

If no failures were encountered, write: **No failures encountered during validation.**

---

## Rollback Events

Record any rollback events that occurred during validation.

| # | Stage | Timestamp | Trigger | Action Taken | Recovery Time | Follow-Up |
|---|---|---|---|---|---|---|
| | | | | | | |

If no rollback was performed, write: **No rollback events during validation.**

---

## Open Questions Resolved

Record resolutions for open questions from TASK-0042 rollout plan.

| # | Question | Resolution | Resolved By | Date |
|---|---|---|---|---|
| 1 | Staging domain / hosting platform | | | |
| 2 | AUTH_URL / NEXTAUTH_URL needed? | | | |
| 3 | Desired session maxAge for staging | | | |
| 4 | Separate Google Cloud project for staging? | | | |
| 5 | Existing logging/APM platform? | | | |
| 6 | Rollback owner identity | | | |
| 7 | Production rollout planning timeline | | | |

---

## Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Operator | | | ☐ Validation complete |
| Reviewer | | | ☐ Evidence reviewed |
| Rollback Owner | | | ☐ Rollback path confirmed |
| CTO | | | ☐ Approved for production planning |

---

## References

| Resource | Path |
|---|---|
| Staging rollout plan | `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` |
| Google OAuth smoke test runbook | `docs/operations/authjs-google-oauth-smoke-test-runbook.md` |
| TASK-0039 authenticated resolver | `docs/checkpoints/TASK-0039-authjs-authenticated-request-context-resolver.md` |
| TASK-0040 tenant resolver | `docs/checkpoints/TASK-0040-authjs-tenant-request-context-resolver.md` |
| TASK-0041 smoke tests | `docs/checkpoints/TASK-0041-authjs-request-context-protected-handler-smoke-tests.md` |
| TASK-0042 rollout plan | `docs/checkpoints/TASK-0042-authjs-request-context-staging-rollout-observability-plan.md` |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-16 | Initial template — TASK-0043 |
