# Auth.js Request-Context Staging Dry-Run Preflight Command Checklist

## Status

Checklist only. No preflight executed.

## Purpose

Provide a command-oriented checklist for operators to use before starting a future Auth.js request-context staging dry-run.

## Non-Goals

- No dry-run execution in this task
- No validation execution in this task
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
- No new npm/pnpm scripts

---

## Safety Rules

1. **Never** paste secrets into terminal history or evidence.
2. **Never** print full env values for secrets (`AUTH_SECRET`, `AUTH_GOOGLE_SECRET`).
3. **Never** print cookies, JWTs, or OAuth tokens.
4. Use **redacted** output in evidence.
5. **Never** run destructive database commands (DELETE, DROP, TRUNCATE).
6. Commands are examples and may need platform adaptation.
7. **Confirm staging target** before every remote command.
8. **Do not** run against production.
9. **Do not** enable flags from this checklist without a signed readiness approval (TASK-0047).

---

## Required Variables

Set these before running any commands. **Do not paste real secret values.**

```bash
export STAGING_BASE_URL="https://staging.example.com"
export EXPECTED_COMMIT_SHA="<expected-main-commit>"
export TEST_USER_ID="<redacted-or-approved-id>"
export TEST_BUSINESS_ID="<business-id>"
export TEST_MEMBERSHIP_ID="<membership-id>"
export EVIDENCE_DIR="./authjs-dry-run-evidence"
```

---

## Preflight 1 — Local Repository Check

### 1.1 Confirm branch and commit

```bash
git fetch origin
git checkout main
git pull origin main
git log -1 --format="%H %s"
```

- [ ] Output commit SHA matches `$EXPECTED_COMMIT_SHA`

### 1.2 Run seven local checks

```bash
pnpm install
pnpm prisma:format
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

- [ ] `pnpm install` — no errors
- [ ] `pnpm prisma:format` — no changes
- [ ] `pnpm prisma:generate` — no errors
- [ ] `pnpm typecheck` — no errors
- [ ] `pnpm lint` — 0 errors (warnings acceptable)
- [ ] `pnpm test` — all pass (expected: 844 passed, 7 skipped)
- [ ] `pnpm build` — exit code 0

---

## Preflight 2 — Staging Deployment Check

### 2.1 Confirm staging is reachable

```bash
curl -s -o /dev/null -w "%{http_code}" "$STAGING_BASE_URL"
```

- [ ] Returns 200 or expected status

### 2.2 Confirm deployed commit (if health endpoint exists)

```bash
curl -s "$STAGING_BASE_URL/api/health" | jq '.version // .commit // .sha'
```

- [ ] Matches `$EXPECTED_COMMIT_SHA` (or verify via deployment console)

---

## Preflight 3 — Feature Flag Baseline Check

### 3.1 Confirm Auth.js flags are OFF

```bash
# Check via staging env/deployment console — do NOT print secret values
# Expected initial state:
# ENABLE_AUTHJS_RUNTIME=false
# ENABLE_AUTHJS_GOOGLE_PROVIDER=false
# ENABLE_AUTHJS_REQUEST_CONTEXT=false
# ENABLE_DEV_AUTH_CONTEXT=false
```

- [ ] `ENABLE_AUTHJS_RUNTIME` is `false`
- [ ] `ENABLE_AUTHJS_GOOGLE_PROVIDER` is `false`
- [ ] `ENABLE_AUTHJS_REQUEST_CONTEXT` is `false`
- [ ] `ENABLE_DEV_AUTH_CONTEXT` is `false`

### 3.2 Confirm Auth.js session returns disabled

```bash
curl -s "$STAGING_BASE_URL/api/auth/session" | jq .
```

- [ ] Returns 501 with `AUTHJS_RUNTIME_DISABLED` (or expected disabled response)

---

## Preflight 4 — Database / Schema Check

### 4.1 Confirm TASK-0031 migration applied

```sql
-- Run via staging database console (read-only)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('User', 'Account', 'VerificationToken')
ORDER BY table_name;
```

- [ ] `Account` table exists
- [ ] `User` table exists
- [ ] `VerificationToken` table exists

### 4.2 Confirm User.emailVerified column

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'User'
  AND column_name = 'emailVerified';
```

- [ ] `emailVerified` column exists

### 4.3 Confirm test user exists

```sql
SELECT id, name FROM "User" WHERE id = '<TEST_USER_ID>';
```

- [ ] Test user row found

### 4.4 Confirm test business exists

```sql
SELECT id, name FROM "Business" WHERE id = '<TEST_BUSINESS_ID>';
```

- [ ] Test business row found

### 4.5 Confirm active membership

```sql
SELECT id, role, status FROM "BusinessMembership"
WHERE "userId" = '<TEST_USER_ID>'
  AND "businessId" = '<TEST_BUSINESS_ID>'
  AND status = 'ACTIVE';
```

- [ ] Active membership row found

---

## Preflight 5 — OAuth Readiness Check

### 5.1 Confirm redirect URI (via Google Cloud Console)

- [ ] `https://<staging>/api/auth/callback/google` is listed as authorized redirect URI

### 5.2 Confirm OAuth secrets configured

```bash
# Verify via deployment console — do NOT print values
# AUTH_GOOGLE_ID — configured
# AUTH_GOOGLE_SECRET — configured
# AUTH_SECRET — configured
```

- [ ] `AUTH_GOOGLE_ID` configured (value not printed)
- [ ] `AUTH_GOOGLE_SECRET` configured (value not printed)
- [ ] `AUTH_SECRET` configured (value not printed)

---

## Preflight 6 — Rollback Readiness Check

### 6.1 Confirm rollback owner

- [ ] Rollback owner name: __________
- [ ] Rollback owner reachable: yes / no
- [ ] Rollback owner can change flags: yes / no

### 6.2 Confirm incident channel

- [ ] Incident channel name: __________
- [ ] Incident channel active: yes / no

### 6.3 Confirm flag disable path

- [ ] Flag change mechanism documented: yes / no
- [ ] Redeploy/restart mechanism documented: yes / no
- [ ] Expected rollback time: < 5 minutes / other: __________

---

## Preflight 7 — Evidence Readiness Check

### 7.1 Confirm evidence template duplicated

```bash
# Copy template
mkdir -p "$EVIDENCE_DIR"
cp docs/operations/authjs-request-context-staging-validation-evidence-template.md \
   "$EVIDENCE_DIR/authjs-request-context-staging-validation-evidence-$(date +%Y-%m-%d).md"
```

- [ ] Evidence copy created
- [ ] Original template not modified

### 7.2 Confirm evidence review checklist available

- [ ] `docs/operations/authjs-request-context-staging-dry-run-evidence-review-checklist.md` accessible

### 7.3 Confirm evidence storage location

- [ ] Approved storage location: __________
- [ ] Operator has write access: yes / no
- [ ] Reviewer has read access: yes / no

---

## Preflight 8 — Protected Handler Baseline Check

### 8.1 Confirm protected handlers return expected disabled response

```bash
curl -s "$STAGING_BASE_URL/api/businesses" | jq .
```

- [ ] Returns 501 `AUTH_CONTEXT_UNAVAILABLE` (or expected disabled response)

```bash
curl -s "$STAGING_BASE_URL/api/businesses/$TEST_BUSINESS_ID" | jq .
```

- [ ] Returns 501 `AUTH_CONTEXT_UNAVAILABLE` (or expected disabled response)

---

## Preflight 9 — Connectivity and Access Check

### 9.1 Confirm logs access

- [ ] Operator can view staging application logs: yes / no
- [ ] Log viewer tool/URL: __________

### 9.2 Confirm database read access

- [ ] Operator can run read-only queries on staging: yes / no
- [ ] Database console tool/URL: __________

### 9.3 Confirm deployment console access

- [ ] Operator can view/change env vars: yes / no
- [ ] Operator can trigger redeploy: yes / no
- [ ] Deployment console tool/URL: __________

---

## Preflight Summary

| Check | Status |
|---|---|
| 1 — Local repository | ☐ Pass / ☐ Fail |
| 2 — Staging deployment | ☐ Pass / ☐ Fail |
| 3 — Feature flag baseline | ☐ Pass / ☐ Fail |
| 4 — Database / schema | ☐ Pass / ☐ Fail |
| 5 — OAuth readiness | ☐ Pass / ☐ Fail |
| 6 — Rollback readiness | ☐ Pass / ☐ Fail |
| 7 — Evidence readiness | ☐ Pass / ☐ Fail |
| 8 — Protected handler baseline | ☐ Pass / ☐ Fail |
| 9 — Connectivity and access | ☐ Pass / ☐ Fail |

### Overall Preflight Result

- [ ] **ALL PASS** — Ready to proceed to Stage 0
- [ ] **ONE OR MORE FAIL** — Do not proceed. Record blocking issues in readiness sign-off (TASK-0047).

---

## References

| Resource | Path |
|---|---|
| Readiness sign-off template | `docs/operations/authjs-request-context-staging-dry-run-readiness-signoff-template.md` |
| Operator packet | `docs/operations/authjs-request-context-staging-dry-run-operator-packet.md` |
| Execution guide | `docs/operations/authjs-request-context-staging-dry-run-execution-guide.md` |
| Evidence review checklist | `docs/operations/authjs-request-context-staging-dry-run-evidence-review-checklist.md` |
| Evidence template | `docs/operations/authjs-request-context-staging-validation-evidence-template.md` |
| Rollout/observability plan | `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` |
| Google OAuth smoke-test runbook | `docs/operations/authjs-google-oauth-smoke-test-runbook.md` |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-17 | Initial preflight command checklist — TASK-0048 |
