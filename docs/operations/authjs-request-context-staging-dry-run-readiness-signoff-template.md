# Auth.js Request-Context Staging Dry-Run Readiness Sign-Off Template

## Status

Template only. No dry-run executed.

## Purpose

Provide a pre-execution readiness sign-off template for confirming that a future Auth.js request-context staging dry-run is safe to begin.

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

## Instructions

- Duplicate this template before use — never edit the original.
- Fill it before Stage 0 execution.
- Every required sign-off must be completed before enabling any Auth.js flag.
- Unresolved P0/P1 readiness items block execution.
- Do not paste secrets, cookies, JWTs, OAuth tokens, or full session payloads.
- Completed sign-off may contain sensitive operational identifiers and should be stored according to policy.

---

## Sign-Off Metadata

| Field | Value |
|---|---|
| Sign-Off Date | TBD |
| Environment | staging |
| Staging URL | TBD |
| Deployment Commit SHA | TBD |
| Deployment ID / App Version | TBD |
| Operator | TBD |
| Reviewer | TBD |
| Rollback Owner | TBD |
| CTO / System Designer | TBD |
| Incident Channel | TBD |
| Evidence Storage Location | TBD |
| Planned Dry-Run Start Time | TBD |
| Planned Stage 4 Soak Window | TBD |

---

## Artifact Readiness

| Artifact | Required | Current Location | Owner | Ready? | Notes |
|---|---:|---|---|---|---|
| TASK-0042 rollout/observability plan | Yes | `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` | TBD | TBD | TBD |
| TASK-0043 evidence template copy | Yes | TBD (duplicate before use) | TBD | TBD | TBD |
| TASK-0044 review checklist | Yes | `docs/operations/authjs-request-context-staging-dry-run-evidence-review-checklist.md` | TBD | TBD | TBD |
| TASK-0045 execution guide | Yes | `docs/operations/authjs-request-context-staging-dry-run-execution-guide.md` | TBD | TBD | TBD |
| TASK-0046 operator packet | Yes | `docs/operations/authjs-request-context-staging-dry-run-operator-packet.md` | TBD | TBD | TBD |
| Google OAuth smoke-test runbook | Yes | `docs/operations/authjs-google-oauth-smoke-test-runbook.md` | TBD | TBD | TBD |

---

## People Readiness

| Role | Name | Contact | Availability Window | Backup | Sign-Off |
|---|---|---|---|---|---|
| Operator | TBD | TBD | TBD | TBD | TBD |
| Reviewer | TBD | TBD | TBD | TBD | TBD |
| Rollback Owner | TBD | TBD | TBD | TBD | TBD |
| CTO / System Designer | TBD | TBD | TBD | TBD | TBD |
| Product / Owner | TBD | TBD | TBD | TBD | Optional |

---

## Access Readiness

| Access | Required For | Owner | Verified? | Evidence / Notes |
|---|---|---|---|---|
| Staging deployment console | Flag/env updates and redeploys | TBD | TBD | TBD |
| Staging application logs | Troubleshooting and evidence | TBD | TBD | TBD |
| Database read access | Verifying User/Account/membership | TBD | TBD | TBD |
| Google Cloud Console OAuth app | OAuth redirect/client verification | TBD | TBD | TBD |
| Evidence storage location | Storing completed evidence | TBD | TBD | TBD |
| Incident channel | Rollback coordination | TBD | TBD | TBD |

---

## Environment Readiness

- [ ] Staging URL reachable
- [ ] Latest main commit deployed or deployment target confirmed
- [ ] `ENABLE_API_HANDLERS` expected state confirmed
- [ ] `ENABLE_DEV_AUTH_CONTEXT` expected state confirmed
- [ ] No production environment targeted
- [ ] No env files committed
- [ ] Flag change mechanism understood
- [ ] Redeploy/restart mechanism understood

---

## Schema / Data Readiness

- [ ] TASK-0031 migration applied in staging
- [ ] `User.emailVerified` column exists
- [ ] `Account` table exists
- [ ] `VerificationToken` table exists
- [ ] Internal `Session` model unchanged
- [ ] Test user exists (ID: __________)
- [ ] Test business exists (ID: __________)
- [ ] Active `BusinessMembership` exists for test user and business (ID: __________)
- [ ] Test user role recorded (role: __________)
- [ ] Inactive/no-membership negative case available or documented as not reproducible

---

## OAuth Readiness

- [ ] Staging Google OAuth app exists
- [ ] OAuth client ID label recorded (label: __________)
- [ ] Redirect URI configured: `https://<staging>/api/auth/callback/google`
- [ ] OAuth consent screen suitable for staging
- [ ] Test user allowed to sign in
- [ ] `AUTH_GOOGLE_ID` configured in staging secret/env system
- [ ] `AUTH_GOOGLE_SECRET` configured in staging secret/env system
- [ ] No OAuth secret value pasted into sign-off

---

## Feature Flag Readiness

| Flag | Required Initial State | Change Stage | Verified? | Notes |
|---|---|---|---|---|
| `ENABLE_AUTHJS_RUNTIME` | `false` | Stage 1 | TBD | TBD |
| `ENABLE_AUTHJS_GOOGLE_PROVIDER` | `false` | Stage 2 | TBD | TBD |
| `ENABLE_AUTHJS_REQUEST_CONTEXT` | `false` | Stage 3 | TBD | TBD |
| `ENABLE_DEV_AUTH_CONTEXT` | `false` | All stages | TBD | Must remain `false` |
| `ENABLE_API_HANDLERS` | Existing expected state | Prerequisite | TBD | Do not change unless planned |

---

## Rollback Readiness

| Check | Expected | Owner | Verified? | Notes |
|---|---|---|---|---|
| Rollback owner available | Yes | TBD | TBD | TBD |
| Rollback owner can change flags | Yes | TBD | TBD | TBD |
| Flag disable path known | Yes | TBD | TBD | TBD |
| Redeploy/restart path known | Yes | TBD | TBD | TBD |
| Incident channel active | Yes | TBD | TBD | TBD |
| Schema rollback not required | Confirmed | TBD | TBD | TBD |
| Data deletion not required | Confirmed | TBD | TBD | TBD |
| Kill-switch behavior understood | Confirmed | TBD | TBD | TBD |

---

## Safety Acknowledgement

- [ ] No secrets will be pasted into evidence
- [ ] No cookies will be pasted into evidence
- [ ] No JWTs will be pasted into evidence
- [ ] No OAuth tokens will be pasted into evidence
- [ ] No full session object will be pasted into evidence
- [ ] Emails/screenshots will be redacted
- [ ] Account/User/VerificationToken rows will not be deleted during rollback
- [ ] Prisma schema will not be changed during dry-run
- [ ] Production rollout is not approved by this sign-off

---

## Stop Condition Acknowledgement

- [ ] Stop on secret/token/cookie exposure
- [ ] Stop on auth bypass
- [ ] Stop on tenant isolation failure
- [ ] Stop if route-param `businessId` is overridden by header
- [ ] Stop on unexplained sustained 5xx spike
- [ ] Stop if rollback owner becomes unavailable
- [ ] Stop if rollback path fails
- [ ] Stop if database migration mismatch is found
- [ ] Stop on widespread OAuth callback failure
- [ ] Stop on Account/User persistence corruption

---

## Pre-Execution Decision

| Field | Value |
|---|---|
| Ready To Start Dry-Run? | Yes / No |
| Blocking Readiness Issues | TBD |
| Non-Blocking Readiness Issues | TBD |
| Required Follow-Up Before Start | TBD |
| Approved Start Time | TBD |
| Approver | TBD |
| Approval Timestamp | TBD |

---

## Sign-Off

| Role | Name | Decision | Timestamp | Notes |
|---|---|---|---|---|
| Operator | TBD | READY / NOT_READY | TBD | TBD |
| Reviewer | TBD | READY / NOT_READY | TBD | TBD |
| Rollback Owner | TBD | READY / NOT_READY | TBD | TBD |
| CTO / System Designer | TBD | APPROVED / NOT_APPROVED | TBD | TBD |
| Product / Owner | TBD | ACKNOWLEDGED / N/A | TBD | TBD |

---

## References

| Resource | Path |
|---|---|
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
| 1.0 | 2026-05-17 | Initial readiness sign-off template — TASK-0047 |
