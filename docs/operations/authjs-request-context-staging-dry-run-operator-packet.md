# Auth.js Request-Context Staging Dry-Run Operator Packet

## Status

Operator packet only. No dry-run executed.

## Purpose

Provide a single entry point for operators, reviewers, rollback owner, and CTO/system designer to coordinate a future Auth.js request-context staging dry-run.

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

---

## Packet Contents

| Artifact | Path | Purpose | Required Before Dry-Run |
|---|---|---|---|
| TASK-0042 rollout/observability plan | `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` | Defines rollout stages and monitoring plan | Yes |
| TASK-0043 evidence template | `docs/operations/authjs-request-context-staging-validation-evidence-template.md` | Captures execution evidence | Yes |
| TASK-0044 evidence review checklist | `docs/operations/authjs-request-context-staging-dry-run-evidence-review-checklist.md` | Reviews evidence pack | Yes |
| TASK-0045 execution guide | `docs/operations/authjs-request-context-staging-dry-run-execution-guide.md` | Operator step-by-step guide | Yes |
| Google OAuth smoke-test runbook | `docs/operations/authjs-google-oauth-smoke-test-runbook.md` | OAuth setup and manual validation reference | Yes |

---

## Audience and Responsibilities

| Role | Responsible For | Required Sign-Off |
|---|---|---|
| Operator | Executes dry-run and fills evidence | Yes |
| Reviewer | Reviews evidence for completeness | Yes |
| Rollback Owner | Confirms rollback readiness | Yes |
| CTO / System Designer | Final dry-run decision | Yes |
| Product / Owner | Business-impact awareness | Optional |

---

## Required Inputs Summary

The following must be available before starting the dry-run:

| Input | Source | Status |
|---|---|---|
| Staging URL | Ops | TBD |
| Deployment commit SHA | Ops | TBD |
| Operator | CTO assignment | TBD |
| Reviewer | CTO assignment | TBD |
| Rollback owner | CTO assignment | TBD |
| Incident channel | Ops | TBD |
| Google OAuth staging app (Client ID label) | Google Cloud Console | TBD |
| Test user (ID, redacted email) | Staging database | TBD |
| Test business (ID) | Staging database | TBD |
| Active BusinessMembership (ID, role) | Staging database | TBD |
| Application logs access | Ops | TBD |
| Database verification access | Ops | TBD |
| Feature flag / deployment env configuration access | Ops | TBD |
| Approved evidence storage location | CTO / Ops | TBD |

---

## Pre-Flight Packet Checklist

All items must be confirmed before the operator begins execution.

- [ ] Latest main deployed to staging
- [ ] Expected commit SHA recorded
- [ ] TASK-0031 migration confirmed applied
- [ ] `Account` table confirmed exists
- [ ] `VerificationToken` table confirmed exists
- [ ] `User.emailVerified` column confirmed exists
- [ ] Google OAuth staging app confirmed configured
- [ ] Redirect URI confirmed (`https://<staging>/api/auth/callback/google`)
- [ ] Test user confirmed exists in staging
- [ ] Test business confirmed exists in staging
- [ ] Active BusinessMembership confirmed for test user
- [ ] Rollback owner confirmed available
- [ ] Incident channel confirmed active
- [ ] Evidence template copied (TASK-0043 — never edit original)
- [ ] Evidence review checklist assigned to reviewer (TASK-0044)
- [ ] Operator has all required access (logs, DB, env config)
- [ ] Reviewer has all required access (evidence, checklist)
- [ ] CTO review window scheduled

---

## Execution Order

```
 1. Read this operator packet
 2. Open TASK-0045 execution guide
 3. Duplicate TASK-0043 evidence template
 4. Fill metadata and redaction acknowledgement
 5. Run pre-execution gate (TASK-0045)
 6. Execute Stage 0 — Baseline
 7. Execute Stage 1 — Auth.js Runtime
 8. Execute Stage 2 — Google OAuth Provider
 9. Execute Stage 3 — Auth.js Request-Context
10. Execute Stage 4 — Staging Soak (24–72 hours)
11. Complete evidence template (all sections)
12. Reviewer runs TASK-0044 evidence review checklist
13. CTO records final decision
14. Create follow-up tasks for any issues
```

---

## Stage Summary

| Stage | Flags | Purpose | Required Evidence |
|---|---|---|---|
| Stage 0 | All Auth.js flags `false` | Baseline | Disabled behavior, baseline protected handler (501) |
| Stage 1 | Runtime `true`, provider/context `false` | Runtime only | Session/signin route evidence |
| Stage 2 | Runtime/provider `true`, context `false` | Google OAuth | Provider, sign-in, User/Account persistence |
| Stage 3 | Runtime/provider/context `true` | Request-context | Authenticated/tenant context, protected handlers, error contract |
| Stage 4 | Same as Stage 3 | Soak | Error rates, latency, logs, smoke tests |

---

## Critical Stop Conditions

The operator must **stop immediately** and initiate rollback if any of the following occur:

- Secret, token, or cookie exposure in logs or evidence
- Auth bypass (unauthorized access succeeds)
- Tenant isolation failure (wrong tenant data returned)
- Route-param `businessId` overridden by `x-business-id` header
- Unexplained sustained 5xx error spike
- Rollback owner unavailable during Stage 3/4
- Rollback path fails (flag disable does not restore expected behavior)
- Database migration mismatch (TASK-0031 not applied)
- Google OAuth callback widespread failure
- Account/User persistence corruption (duplicate or orphaned records)

---

## Evidence Storage Policy

- **Do not commit** filled evidence to the repo unless policy explicitly allows.
- **Store evidence** in the approved internal location (shared drive, internal wiki, or private repo).
- **Redact** all evidence before sharing (see Redaction Reminder below).
- **Link** evidence location in the review checklist decision record.
- **Keep an immutable copy** after sign-off — do not modify evidence after approval.

---

## Redaction Reminder

The following must **never** appear in evidence, screenshots, or shared documents:

- `AUTH_SECRET` value
- `AUTH_GOOGLE_SECRET` / `GOOGLE_CLIENT_SECRET` value
- Session cookies (e.g., `next-auth.session-token`)
- JWT token values
- OAuth access tokens, refresh tokens, or ID tokens
- Full session object payloads
- Provider callback codes or state parameters

**Redact:**

- Email addresses (e.g., `j***@example.com`)
- User names (if PII policy requires)

**Screenshots must:**

- Hide browser cookie panels
- Hide request headers containing session tokens
- Hide response bodies containing full JWT payloads

---

## Rollback Summary

| Failure Area | First Rollback Action |
|---|---|
| Request-context failure | Disable `ENABLE_AUTHJS_REQUEST_CONTEXT`, restart |
| Google OAuth provider failure | Disable `ENABLE_AUTHJS_GOOGLE_PROVIDER`, restart |
| Auth.js runtime failure | Disable `ENABLE_AUTHJS_RUNTIME`, restart |
| Unrelated API incident | Do not change Auth.js flags unless implicated |

**Rollback rules:**

- Do not roll back database schema
- Do not delete User, Account, or VerificationToken rows
- Record every rollback event in the evidence template
- Notify the team via incident channel
- Confirm recovery within 5 minutes

---

## Decision Flow

```
┌─────────────────────────────┐
│ 1. Operator completes       │
│    evidence template        │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│ 2. Reviewer checks evidence │
│    using TASK-0044 checklist │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│ 3. Reviewer assigns outcome │
│    ┌─ APPROVED              │
│    ├─ APPROVED_WITH_NOTES   │
│    ├─ CHANGES_REQUIRED      │
│    └─ REJECTED              │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│ 4. CTO confirms outcome    │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│ 5. Follow-up tasks created  │
│    for any P0–P2 issues     │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│ 6. Dry-run approval does    │
│    NOT approve production   │
│    rollout                  │
└─────────────────────────────┘
```

---

## Packet Completion Criteria

This packet is complete when:

- [ ] All referenced docs are linked (5 artifacts)
- [ ] Roles are defined (5 roles)
- [ ] Inputs are listed (14 inputs)
- [ ] Execution order is clear (14 steps)
- [ ] Stop conditions are explicit (10 conditions)
- [ ] Evidence storage policy is defined
- [ ] Redaction reminder is defined
- [ ] Rollback summary is defined
- [ ] Decision flow is defined
- [ ] Pre-flight checklist is defined (18 items)

---

## References

| Resource | Path |
|---|---|
| Rollout/observability plan | `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` |
| Evidence template | `docs/operations/authjs-request-context-staging-validation-evidence-template.md` |
| Evidence review checklist | `docs/operations/authjs-request-context-staging-dry-run-evidence-review-checklist.md` |
| Execution guide | `docs/operations/authjs-request-context-staging-dry-run-execution-guide.md` |
| Google OAuth smoke-test runbook | `docs/operations/authjs-google-oauth-smoke-test-runbook.md` |
| TASK-0039 checkpoint | `docs/checkpoints/TASK-0039-authjs-authenticated-request-context-resolver.md` |
| TASK-0040 checkpoint | `docs/checkpoints/TASK-0040-authjs-tenant-request-context-resolver.md` |
| TASK-0041 checkpoint | `docs/checkpoints/TASK-0041-authjs-request-context-protected-handler-smoke-tests.md` |
| TASK-0042 checkpoint | `docs/checkpoints/TASK-0042-authjs-request-context-staging-rollout-observability-plan.md` |
| TASK-0043 checkpoint | `docs/checkpoints/TASK-0043-authjs-request-context-staging-validation-evidence-template.md` |
| TASK-0044 checkpoint | `docs/checkpoints/TASK-0044-authjs-request-context-staging-dry-run-evidence-review-checklist.md` |
| TASK-0045 checkpoint | `docs/checkpoints/TASK-0045-authjs-request-context-staging-dry-run-execution-guide.md` |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-17 | Initial operator packet — TASK-0046 |
