# Auth.js Request-Context Staging Dry-Run Execution Guide

## Status

Guide only. No dry-run executed.

## Purpose

Define the exact operator procedure for running a future staging dry-run using the approved rollout plan (TASK-0042), evidence template (TASK-0043), and evidence review checklist (TASK-0044).

## Non-Goals

- No dry-run execution in this task
- No staging rollout execution in this task
- No production rollout approval
- No feature flag changes in repo
- No env file commits
- No runtime behavior changes
- No middleware
- No UI
- No logging/metrics implementation
- No schema/migration changes
- No package changes

---

## Required Inputs Before Execution

The following must be available before the operator begins:

| Input | Source |
|---|---|
| Approved rollout plan | TASK-0042 `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` |
| Approved evidence template | TASK-0043 `docs/operations/authjs-request-context-staging-validation-evidence-template.md` |
| Approved evidence review checklist | TASK-0044 `docs/operations/authjs-request-context-staging-dry-run-evidence-review-checklist.md` |
| Staging deployment URL | Ops |
| Staging deployment commit SHA | Ops |
| Staging operator | CTO assignment |
| Reviewer | CTO assignment |
| CTO / system designer | — |
| Rollback owner | CTO assignment |
| Incident channel | Ops |
| Staging Google OAuth app (Client ID label) | Ops / Google Cloud Console |
| Test user (ID, redacted email) | Staging database |
| Test business (ID) | Staging database |
| Active BusinessMembership (ID, role) | Staging database |
| Access to application logs | Ops |
| Access to database verification mechanism | Ops |
| Access to feature flag / deployment env configuration | Ops |

---

## Operator Safety Rules

1. **Duplicate** the evidence template before starting — never edit the original.
2. **Never paste** secrets (`AUTH_SECRET`, `AUTH_GOOGLE_SECRET`), cookies, JWTs, OAuth tokens, or full session payloads into evidence.
3. **Redact** emails and screenshots per the redaction policy in TASK-0043.
4. **Record exact timestamps** for every action.
5. **Record every flag state** before and after changes.
6. **Stop immediately** on any P0 or P1 condition (see severity rubric in TASK-0044).
7. **Do not continue** to the next stage after a failed rollback readiness check.
8. **Do not delete** Account, User, or VerificationToken data during rollback.
9. **Do not change** Prisma schema or run migrations during dry-run.
10. **Do not commit** filled evidence to the repo if it contains environment-specific or sensitive information unless policy explicitly allows.

---

## Execution Overview

```
┌─────────────────────────────────────────────────────┐
│  1. Prepare evidence pack                           │
│  2. Confirm baseline commit / deployment            │
│  3. Confirm database / schema readiness             │
│  4. Confirm OAuth readiness                         │
│  5. Confirm rollback readiness                      │
│  6. Run Stage 0 — Baseline                          │
│  7. Run Stage 1 — Auth.js runtime                   │
│  8. Run Stage 2 — Google provider                   │
│  9. Run Stage 3 — Auth.js request-context           │
│ 10. Run Stage 4 — Staging soak (24–72 hours)        │
│ 11. Complete evidence template                      │
│ 12. Run evidence review checklist (TASK-0044)        │
│ 13. Record final decision                           │
└─────────────────────────────────────────────────────┘
```

---

## Pre-Execution Gate

All items must be checked before proceeding to Stage 0.

- [ ] PR #49 or later merged into main
- [ ] Staging deployment running expected commit SHA
- [ ] All seven local checks green on that commit (install, format, generate, typecheck, lint, test, build)
- [ ] TASK-0031 migration applied in staging database
- [ ] `Account` table exists in staging database
- [ ] `VerificationToken` table exists in staging database
- [ ] `User.emailVerified` column exists in staging database
- [ ] Google OAuth redirect URI configured for staging (`https://<staging>/api/auth/callback/google`)
- [ ] Test user exists in staging `User` table
- [ ] Test business exists in staging `Business` table
- [ ] Test user has active `BusinessMembership` in staging
- [ ] Rollback owner available and reachable
- [ ] Incident channel active
- [ ] Evidence template duplicated (not editing original)
- [ ] Evidence review checklist available (TASK-0044)

---

## Evidence Pack Setup

1. Copy `docs/operations/authjs-request-context-staging-validation-evidence-template.md`.
2. Name the copy with date and environment:
   ```
   authjs-request-context-staging-validation-evidence-YYYY-MM-DD.md
   ```
3. Fill in the **Validation Metadata** section before Stage 0.
4. Do not commit filled evidence to the repo if it contains environment-specific or sensitive information unless policy explicitly allows.
5. Store evidence in the approved internal location (shared drive, internal wiki, or private repo).

---

## Stage 0 — Baseline Execution

**Objective:** Confirm all auth routes return disabled/unavailable responses when flags are off.

### Flags

```env
ENABLE_AUTHJS_RUNTIME=false
ENABLE_AUTHJS_GOOGLE_PROVIDER=false
ENABLE_AUTHJS_REQUEST_CONTEXT=false
ENABLE_API_HANDLERS=true
ENABLE_DEV_AUTH_CONTEXT=false
```

### Steps

1. Record timestamp.
2. Confirm all three flags are `false` in staging env.
3. Run:
   ```bash
   curl -s https://<staging>/api/auth/session | jq .
   ```
   Expected: 501 with `AUTHJS_RUNTIME_DISABLED`.
4. Run a protected handler request without any auth header:
   ```bash
   curl -s https://<staging>/api/businesses | jq .
   ```
   Expected: 501 with `AUTH_CONTEXT_UNAVAILABLE`.
5. Check application logs for unexpected errors.
6. Fill Stage 0 section in evidence template.

### Gate

- [ ] Both requests return expected 501 responses
- [ ] No unexplained errors in logs
- [ ] Evidence recorded

**If gate fails:** Stop. Record failure in evidence. Do not proceed to Stage 1.

---

## Stage 1 — Auth.js Runtime Execution

**Objective:** Confirm Auth.js route runtime starts and session endpoint works.

### Flag Change

```env
ENABLE_AUTHJS_RUNTIME=true    # ← changed
ENABLE_AUTHJS_GOOGLE_PROVIDER=false
ENABLE_AUTHJS_REQUEST_CONTEXT=false
```

### Additional Env Required

- `AUTH_SECRET` — set in staging env (do not paste value in evidence)

### Steps

1. Record timestamp.
2. Set `ENABLE_AUTHJS_RUNTIME=true` in staging env.
3. Set `AUTH_SECRET` in staging env.
4. Restart/redeploy the application.
5. Run:
   ```bash
   curl -s https://<staging>/api/auth/session | jq .
   ```
   Expected: 200 with null/empty session.
6. Run:
   ```bash
   curl -s https://<staging>/api/auth/signin
   ```
   Expected: 200 (sign-in page HTML, no Google provider button).
7. Verify protected handlers are unchanged (still 501).
8. Check application logs — no errors expected.
9. Fill Stage 1 section in evidence template.

### Gate

- [ ] Session endpoint returns 200
- [ ] Sign-in page loads without providers
- [ ] Protected handlers unchanged
- [ ] No errors in logs
- [ ] Evidence recorded

**If gate fails:** Rollback — set `ENABLE_AUTHJS_RUNTIME=false`, restart. Record failure.

---

## Stage 2 — Google OAuth Provider Execution

**Objective:** Confirm Google OAuth sign-in flow works end-to-end.

### Flag Change

```env
ENABLE_AUTHJS_RUNTIME=true
ENABLE_AUTHJS_GOOGLE_PROVIDER=true    # ← changed
ENABLE_AUTHJS_REQUEST_CONTEXT=false
```

### Additional Env Required

- `AUTH_GOOGLE_ID` — set in staging env
- `AUTH_GOOGLE_SECRET` — set in staging env (do not paste values in evidence)

### Steps

1. Record timestamp.
2. Set `ENABLE_AUTHJS_GOOGLE_PROVIDER=true` in staging env.
3. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in staging env.
4. Restart/redeploy the application.
5. Visit `https://<staging>/api/auth/signin` in browser.
6. Confirm Google sign-in button is visible.
7. Click Google sign-in, complete OAuth consent.
8. Confirm redirect to callback — no errors.
9. Run:
   ```bash
   curl -s -b cookies.txt https://<staging>/api/auth/session | jq .
   ```
   Expected: 200 with user data (id, email, name). **Redact email in evidence.**
10. Verify `User` record created in staging database:
    ```sql
    SELECT id, name, "emailVerified" FROM "User" WHERE id = '<user-id>';
    ```
11. Verify `Account` record created:
    ```sql
    SELECT id, provider, type FROM "Account" WHERE "userId" = '<user-id>';
    ```
12. Verify protected handlers are still unchanged (501).
13. Check application logs — no secrets should be logged.
14. Fill Stage 2 section in evidence template.

### Gate

- [ ] Google sign-in completes
- [ ] Session contains user data
- [ ] User record exists
- [ ] Account record exists (Google provider)
- [ ] Protected handlers unchanged
- [ ] No secrets in logs
- [ ] Evidence recorded

**If gate fails:** Rollback — set `ENABLE_AUTHJS_GOOGLE_PROVIDER=false`, restart. Record failure.

---

## Stage 3 — Auth.js Request-Context Execution

**Objective:** Confirm protected handlers work with Auth.js session-based request-context resolution.

### Flag Change

```env
ENABLE_AUTHJS_RUNTIME=true
ENABLE_AUTHJS_GOOGLE_PROVIDER=true
ENABLE_AUTHJS_REQUEST_CONTEXT=true    # ← changed
ENABLE_DEV_AUTH_CONTEXT=false          # ← must remain false
```

### Preconditions

- [ ] `ENABLE_DEV_AUTH_CONTEXT=false` confirmed
- [ ] Rollback owner available
- [ ] Incident channel active

### Steps

1. Record timestamp.
2. Confirm `ENABLE_DEV_AUTH_CONTEXT=false`.
3. Set `ENABLE_AUTHJS_REQUEST_CONTEXT=true` in staging env.
4. Restart/redeploy the application.
5. Run authenticated context tests:
   ```bash
   # Without session → 401
   curl -s https://<staging>/api/businesses | jq .

   # With session → 200
   curl -s -b cookies.txt https://<staging>/api/businesses | jq .
   ```
6. Run tenant context (route-param) tests:
   ```bash
   # Valid business with membership → 200
   curl -s -b cookies.txt https://<staging>/api/businesses/<valid-id> | jq .

   # Unknown business → 403
   curl -s -b cookies.txt https://<staging>/api/businesses/<unknown-id> | jq .

   # Memberships list → 200
   curl -s -b cookies.txt https://<staging>/api/businesses/<valid-id>/memberships | jq .

   # Audit events → 200
   curl -s -b cookies.txt https://<staging>/api/businesses/<valid-id>/audit-events | jq .
   ```
7. Run tenant context (header fallback) tests:
   ```bash
   # With header → 200
   curl -s -b cookies.txt -H "x-business-id: <valid-id>" \
     https://<staging>/api/authz/evaluate -X POST | jq .

   # Without header → 403
   curl -s -b cookies.txt \
     https://<staging>/api/authz/evaluate -X POST | jq .
   ```
8. Run negative case tests:
   ```bash
   # Expired/missing session → 401
   curl -s https://<staging>/api/businesses | jq .

   # Whitespace header → 403
   curl -s -b cookies.txt -H "x-business-id:  " \
     https://<staging>/api/authz/evaluate -X POST | jq .

   # No membership → 403
   curl -s -b cookies.txt https://<staging>/api/businesses/<no-membership-id> | jq .
   ```
9. Run route-param priority tests:
   ```bash
   # Route param + mismatched header → route param wins
   curl -s -b cookies.txt -H "x-business-id: <other-id>" \
     https://<staging>/api/businesses/<valid-id> | jq .
   ```
10. Run kill-switch test:
    ```bash
    # Disable flag → 501
    # Set ENABLE_AUTHJS_REQUEST_CONTEXT=false, restart
    curl -s -b cookies.txt https://<staging>/api/businesses | jq .
    # Expected: 501 AUTH_CONTEXT_UNAVAILABLE

    # Re-enable flag → works again
    # Set ENABLE_AUTHJS_REQUEST_CONTEXT=true, restart
    curl -s -b cookies.txt https://<staging>/api/businesses | jq .
    # Expected: 200
    ```
11. Fill Stage 3 section in evidence template.
12. Fill Error Contract Evidence section.
13. Fill Protected Handler Evidence section.
14. Fill Route-Param Tenant Scope Evidence section.

### Gate

- [ ] Authenticated context works (401 without session, 200 with)
- [ ] Tenant context from route-param works
- [ ] Tenant context from header fallback works
- [ ] Negative cases return expected errors
- [ ] Route-param wins over mismatched header
- [ ] Kill-switch works (disable → 501, enable → restored)
- [ ] Error contract fully verified
- [ ] Evidence recorded

**If gate fails:** Rollback — set `ENABLE_AUTHJS_REQUEST_CONTEXT=false`, restart. Record failure.

---

## Stage 4 — Staging Soak Execution

**Objective:** Confirm stability over 24–72 hours with all flags enabled.

### Flags

```env
ENABLE_AUTHJS_RUNTIME=true
ENABLE_AUTHJS_GOOGLE_PROVIDER=true
ENABLE_AUTHJS_REQUEST_CONTEXT=true
ENABLE_DEV_AUTH_CONTEXT=false
```

### Steps

1. Record soak start timestamp.
2. All three flags remain enabled from Stage 3.
3. Monitor periodically (recommended: every 4–8 hours):
   - Check application logs for errors
   - Check 501/401/400/403 error rates
   - Check OAuth callback error rates
   - Verify session endpoint still works
   - Verify a protected handler still works
4. Record observations in the Monitoring Log table.
5. At the end of the soak period:
   - Record soak end timestamp and duration.
   - Run the full Stage 3 validation again.
   - Confirm smoke tests still pass.
   - Run kill-switch rollback test one more time.
6. Fill Stage 4 section in evidence template.
7. Fill Observability Evidence section.
8. Fill Rollback Readiness Evidence section.

### Gate

- [ ] Soak duration meets 24–72 hour target (or deviation justified)
- [ ] No sustained 5xx error rate increase
- [ ] No unexplained tenant context failures
- [ ] No unexplained OAuth callback error spikes
- [ ] Smoke tests remain green
- [ ] Kill-switch rollback verified
- [ ] Evidence recorded

**If gate fails:** Rollback — set `ENABLE_AUTHJS_REQUEST_CONTEXT=false`, restart. Record failure. Evaluate whether to retry soak or stop.

---

## Post-Execution Steps

### 1. Complete Evidence Template

Fill any remaining sections:

- [ ] Exit Criteria Summary (must-have, should-have, nice-to-have)
- [ ] Final Validation Summary
- [ ] Failure Modes Encountered (or mark "No failures encountered")
- [ ] Rollback Events (or mark "No rollback events")
- [ ] Issues Log (or mark "No issues logged")
- [ ] Open Questions Resolved (from TASK-0042)

### 2. Sign Off

- [ ] Operator signs the evidence template
- [ ] Reviewer signs after reviewing evidence
- [ ] Rollback owner signs after confirming rollback readiness

### 3. Submit for Review

- Provide completed evidence pack to CTO / system designer.
- CTO/reviewer runs the evidence review checklist (TASK-0044).
- CTO records final decision in the Dry-Run Review Decision Record.

### 4. Record Outcome

| Outcome | Action |
|---|---|
| APPROVED | Proceed to production rollout planning |
| APPROVED_WITH_NOTES | Create follow-up tasks, then proceed |
| CHANGES_REQUIRED | Address gaps, re-run affected stages |
| REJECTED | Stop rollout path, create blocking tasks |

---

## Rollback Quick Reference

### Any Stage — Immediate Rollback

| Stage | Flag to Disable | Expected Behavior After Disable |
|---|---|---|
| Stage 3/4 | `ENABLE_AUTHJS_REQUEST_CONTEXT=false` | Protected handlers return 501 (or dev-header fallback if enabled) |
| Stage 2 | `ENABLE_AUTHJS_GOOGLE_PROVIDER=false` | Google sign-in disappears; existing JWTs expire naturally |
| Stage 1 | `ENABLE_AUTHJS_RUNTIME=false` | All `/api/auth/*` routes return 501 |

### Rollback Steps

1. Set the appropriate flag to `false` in staging env.
2. Restart/redeploy the application.
3. Verify the expected fallback behavior.
4. Notify the team via incident channel.
5. Record in Rollback Events section of evidence template.

### Data Safety During Rollback

- **No data loss** — User, Account, BusinessMembership records remain intact.
- **No schema rollback** needed — flags are runtime-only.
- **JWT sessions** expire naturally.
- **Do not delete** any database records.

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Resolution |
|---|---|---|
| 501 on `/api/auth/session` | `ENABLE_AUTHJS_RUNTIME` not `true` | Check flag value, restart |
| 501 on protected handlers | `ENABLE_AUTHJS_REQUEST_CONTEXT` not `true` or `ENABLE_AUTHJS_RUNTIME` not `true` | Check both flags |
| Google sign-in missing | `ENABLE_AUTHJS_GOOGLE_PROVIDER` not `true` | Check flag value |
| OAuth redirect_uri_mismatch | Staging callback URL not in Google console | Add `https://<staging>/api/auth/callback/google` |
| 500 on callback | Database unreachable or migration not applied | Check DATABASE_URL, apply TASK-0031 migration |
| Session cookie not sent | Cookie domain mismatch | Check AUTH_URL / NEXTAUTH_URL |
| 401 with valid session | AUTH_SECRET mismatch between deployments | Restore consistent AUTH_SECRET |
| 403 on all tenant routes | Test user has no active membership | Create membership in staging database |
| All sessions invalid | AUTH_SECRET rotated | Restore previous AUTH_SECRET or wait for expiry |

---

## References

| Resource | Path |
|---|---|
| Staging rollout plan | `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` |
| Evidence template | `docs/operations/authjs-request-context-staging-validation-evidence-template.md` |
| Evidence review checklist | `docs/operations/authjs-request-context-staging-dry-run-evidence-review-checklist.md` |
| Google OAuth smoke test runbook | `docs/operations/authjs-google-oauth-smoke-test-runbook.md` |
| TASK-0039 checkpoint | `docs/checkpoints/TASK-0039-authjs-authenticated-request-context-resolver.md` |
| TASK-0040 checkpoint | `docs/checkpoints/TASK-0040-authjs-tenant-request-context-resolver.md` |
| TASK-0041 checkpoint | `docs/checkpoints/TASK-0041-authjs-request-context-protected-handler-smoke-tests.md` |
| TASK-0042 checkpoint | `docs/checkpoints/TASK-0042-authjs-request-context-staging-rollout-observability-plan.md` |
| TASK-0043 checkpoint | `docs/checkpoints/TASK-0043-authjs-request-context-staging-validation-evidence-template.md` |
| TASK-0044 checkpoint | `docs/checkpoints/TASK-0044-authjs-request-context-staging-dry-run-evidence-review-checklist.md` |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-17 | Initial guide — TASK-0045 |
