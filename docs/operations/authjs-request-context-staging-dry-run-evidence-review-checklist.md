# Auth.js Request-Context Staging Dry-Run Evidence Review Checklist

## Status

Checklist only. No dry-run executed.

## Purpose

Define a repeatable review checklist for evaluating a completed staging dry-run evidence pack before any real staging rollout or production planning.

## Non-Goals

- No staging rollout execution
- No feature flag changes
- No middleware
- No UI
- No runtime behavior changes
- No logging/metrics implementation
- No schema/migration changes
- No package changes
- No env file changes
- No production rollout approval

---

## Review Inputs

The reviewer must have the following before starting:

- Completed copy of `authjs-request-context-staging-validation-evidence-template.md`
- Git commit SHA under validation
- Deployment ID / app version
- Test user ID
- Test business ID
- Test membership ID
- Redacted OAuth evidence
- Protected handler HTTP evidence
- Log excerpts
- Metrics/dashboard screenshots (if available)
- Rollback readiness evidence
- Sign-off section from template

---

## Reviewer Roles

| Role | Responsibility |
|---|---|
| Operator | Runs validation and captures evidence |
| Reviewer | Checks completeness and consistency |
| CTO / System Designer | Approves/rejects dry-run evidence |
| Rollback Owner | Confirms rollback readiness |
| Product / Owner | Reviews business-impact notes if needed |

---

## Review Outcomes

| Outcome | Meaning | Next Action |
|---|---|---|
| APPROVED | Evidence complete and no blocking issues | Proceed to next planning task |
| APPROVED_WITH_NOTES | Evidence sufficient but non-blocking issues exist | Create follow-up tasks |
| CHANGES_REQUIRED | Evidence incomplete or inconsistent | Rerun/fill missing evidence |
| REJECTED | Blocking safety/security/runtime issue | Stop rollout path |

---

## Severity Rubric

| Severity | Definition | Examples |
|---|---|---|
| P0 | Blocks rollout path immediately | Secrets leaked, wrong tenant access, auth bypass |
| P1 | Blocks approval until fixed | Missing rollback owner, unexplained 5xx spike |
| P2 | Needs follow-up but may not block dry-run approval | Minor doc gap, missing optional screenshot |
| P3 | Cosmetic/non-blocking | Formatting, typo |

---

## Checklist A — Metadata and Redaction Review

- [ ] Validation date present
- [ ] Environment is staging
- [ ] Commit SHA present
- [ ] Deployment ID present
- [ ] Operator present
- [ ] Reviewer present
- [ ] Rollback owner present
- [ ] Incident channel present
- [ ] Test user ID present
- [ ] Test business ID present
- [ ] Test membership ID present
- [ ] No secrets pasted (`AUTH_SECRET`, `AUTH_GOOGLE_SECRET`)
- [ ] No cookies pasted (`next-auth.session-token`)
- [ ] No JWTs pasted
- [ ] No OAuth tokens pasted (access, refresh, ID tokens)
- [ ] No full session object pasted
- [ ] Emails redacted or partially masked
- [ ] Screenshots redacted (no cookies, tokens, or JWTs visible)

---

## Checklist B — Pre-Rollout Readiness Review

- [ ] All seven local checks recorded (install, format, generate, typecheck, lint, test, build)
- [ ] Migration TASK-0031 confirmed applied
- [ ] `Account` table verified
- [ ] `VerificationToken` table verified
- [ ] `User.emailVerified` column verified
- [ ] Google OAuth app configured
- [ ] Redirect URI verified (`https://<staging>/api/auth/callback/google`)
- [ ] Test user exists in `User` table
- [ ] Test business exists in `Business` table
- [ ] Active `BusinessMembership` exists for test user
- [ ] Rollback owner assigned
- [ ] Logs access confirmed
- [ ] Incident channel confirmed

---

## Checklist C — Stage 0 Baseline Review

- [ ] `ENABLE_AUTHJS_RUNTIME=false` evidence present
- [ ] `ENABLE_AUTHJS_GOOGLE_PROVIDER=false` evidence present
- [ ] `ENABLE_AUTHJS_REQUEST_CONTEXT=false` evidence present
- [ ] `GET /api/auth/session` returns 501 `AUTHJS_RUNTIME_DISABLED`
- [ ] Protected handler returns 501 `AUTH_CONTEXT_UNAVAILABLE`
- [ ] No unexplained errors in logs

---

## Checklist D — Stage 1 Runtime Review

- [ ] `ENABLE_AUTHJS_RUNTIME=true` evidence present
- [ ] `ENABLE_AUTHJS_GOOGLE_PROVIDER` remains `false`
- [ ] `ENABLE_AUTHJS_REQUEST_CONTEXT` remains `false`
- [ ] `GET /api/auth/session` returns 200 (null/empty session)
- [ ] `GET /api/auth/signin` returns 200 (sign-in page, no providers)
- [ ] Protected handlers unchanged from Stage 0
- [ ] No provider login available

---

## Checklist E — Stage 2 Google Provider Review

- [ ] `ENABLE_AUTHJS_GOOGLE_PROVIDER=true` evidence present
- [ ] Google provider button visible on sign-in page
- [ ] Google OAuth sign-in completes without error
- [ ] Session contains user ID after sign-in
- [ ] `User` row exists in database
- [ ] `Account` row exists in database (Google provider)
- [ ] Protected handlers remain unchanged from Stage 0/1
- [ ] No secrets in application logs
- [ ] OAuth callback evidence redacted (no tokens, codes, or state params)

---

## Checklist F — Stage 3 Request-Context Review

- [ ] `ENABLE_AUTHJS_REQUEST_CONTEXT=true` evidence present
- [ ] `ENABLE_DEV_AUTH_CONTEXT=false` evidence present
- [ ] Unauthenticated request returns 401 `UNAUTHENTICATED`
- [ ] Valid session produces authenticated context (200)
- [ ] Business route uses route-param `businessId`
- [ ] Mismatched `x-business-id` header does not override route-param `businessId`
- [ ] Generic authz route uses `x-business-id` header
- [ ] Missing generic business scope returns 403 `TENANT_CONTEXT_REQUIRED`
- [ ] Invalid `session.user.id` path captured or explicitly marked not reproducible
- [ ] Missing/inactive membership returns 403 `ACCESS_DENIED`
- [ ] System context remains deferred (not implemented)
- [ ] Kill-switch behavior captured (flag disable → 501, flag enable → restored)

---

## Checklist G — Stage 4 Soak Review

- [ ] Soak start timestamp present
- [ ] Soak end timestamp present
- [ ] Duration recorded
- [ ] 24–72 hour target addressed (or deviation justified)
- [ ] 5xx error rate reviewed
- [ ] 401/400/403/501 rates reviewed
- [ ] OAuth callback errors reviewed
- [ ] Tenant resolver latency reviewed
- [ ] Protected handler latency reviewed
- [ ] Smoke tests remained green
- [ ] Unexplained failures listed or explicitly absent

---

## Checklist H — Error Contract Review

Verify every row in the Error Contract Evidence section:

| Scenario | Expected Code | Expected Status | Verified |
|---|---|---:|---|
| Auth.js infrastructure failure | `AUTH_CONTEXT_UNAVAILABLE` | 501 | ☐ |
| No session (not signed in) | `UNAUTHENTICATED` | 401 | ☐ |
| Missing/empty `session.user.id` | `INVALID_AUTH_CONTEXT` | 400 | ☐ |
| Missing/blank business scope | `TENANT_CONTEXT_REQUIRED` | 403 | ☐ |
| Missing/inactive membership | `ACCESS_DENIED` | 403 | ☐ |

Additional checks:

- [ ] Actual response body matches expected JSON shape
- [ ] No sensitive data in error response body
- [ ] HTTP status codes match exactly

---

## Checklist I — Protected Handler Review

- [ ] Business workspace handlers evidence present (GET, PATCH)
- [ ] Business membership handlers evidence present (GET, POST, PATCH)
- [ ] Tenant audit handlers evidence present (GET list, GET single)
- [ ] Authz generic tenant handlers evidence present (evaluate, require)
- [ ] Downstream services not called when tenant context fails
- [ ] Authz/service ordering evidence or test reference present
- [ ] All handler evidence references correct `businessId`

---

## Checklist J — Route-Param Tenant Scope Review

- [ ] Route-param-only scenario captured (param present, no header)
- [ ] Route-param plus matching header captured (both same ID)
- [ ] Route-param plus mismatched header captured (different IDs)
- [ ] Route-param wins over mismatched header (param takes priority)
- [ ] Blank route-param does not fall back to header (returns 403)
- [ ] Generic route header fallback captured (no param, header used)
- [ ] Generic route without header returns 403 `TENANT_CONTEXT_REQUIRED`
- [ ] No tenant scope taken from query string
- [ ] No tenant scope taken from request body
- [ ] No tenant scope taken from session/JWT

---

## Checklist K — Observability Review

- [ ] Application logs reviewed per stage
- [ ] Auth.js route logs reviewed (if available)
- [ ] Database logs reviewed (if available)
- [ ] 401/400/403/501 rates reviewed
- [ ] OAuth callback errors reviewed
- [ ] Protected handler latency reviewed
- [ ] Tenant resolver latency reviewed
- [ ] Alert rules reviewed (if available)
- [ ] Missing observability tooling recorded as follow-up (not hidden)

---

## Checklist L — Rollback Readiness Review

- [ ] Rollback owner identified
- [ ] Incident channel identified
- [ ] Flag disable path known (env var or deployment config)
- [ ] Rollback dry-run or simulated verification completed
- [ ] Schema rollback explicitly not required
- [ ] Account/User data retention understood (records remain after rollback)
- [ ] Expected rollback time recorded (target < 5 minutes)
- [ ] Kill-switch tested (flag disable → confirm fallback behavior)

---

## Checklist M — Data Safety and Security Review

- [ ] No destructive action taken during validation
- [ ] No schema rollback attempted
- [ ] No Account/User rows deleted
- [ ] No secrets/tokens/cookies logged in evidence
- [ ] Internal Session type unchanged
- [ ] No JWT tenant claims added
- [ ] No role/membership/permission claims added to JWT
- [ ] No authz policy changed

---

## Checklist N — Issues and Follow-Up Review

- [ ] Issues log present in evidence pack
- [ ] Every issue has severity (P0/P1/P2/P3)
- [ ] Every issue has owner
- [ ] Every issue has status (open/resolved)
- [ ] P0/P1 issues block approval
- [ ] P2/P3 issues have follow-up tasks if accepted
- [ ] Unresolved open questions from TASK-0042 listed

---

## Checklist O — Final Sign-Off Review

- [ ] Operator sign-off present
- [ ] Reviewer sign-off present
- [ ] Rollback owner sign-off present
- [ ] CTO/system designer decision present
- [ ] Final outcome selected (APPROVED / APPROVED_WITH_NOTES / CHANGES_REQUIRED / REJECTED)
- [ ] Approval timestamp present
- [ ] Approved next action is consistent with decision

---

## Dry-Run Review Decision Record

| Field | Value |
|---|---|
| Evidence Pack Reviewed | TBD |
| Review Date | TBD |
| Reviewer | TBD |
| Overall Outcome | APPROVED / APPROVED_WITH_NOTES / CHANGES_REQUIRED / REJECTED |
| Blocking Issues | TBD |
| Non-Blocking Issues | TBD |
| Required Follow-Up Tasks | TBD |
| Approved Next Step | TBD |

---

## Approval Criteria

Approval requires ALL of the following:

- No P0 or P1 issues
- All required evidence sections present
- Error contract evidence complete (all 5 scenarios)
- Route-param tenant scope evidence complete (all 7 scenarios)
- Rollback readiness confirmed
- No secret/token/cookie leakage in evidence
- No unexplained 5xx or auth error spikes
- All sign-offs present (operator, reviewer, rollback owner, CTO)

---

## Rejection Criteria

Reject immediately if ANY of the following:

- Secret, token, or cookie leaked in evidence
- Tenant isolation failure observed (wrong tenant data returned)
- Auth bypass observed (unauthorized access succeeded)
- Route-param overridden by `x-business-id` header
- Rollback owner missing
- Rollback path unverified
- Unexplained sustained 5xx increase during soak
- Incomplete error contract evidence (any of 5 scenarios missing)
- Missing protected handler evidence (any handler family missing)

---

## Follow-Up Task Rules

- Every P0/P1 issue creates a blocking follow-up task
- Every accepted P2 issue creates a tracked follow-up task
- P3 issues may be bundled into a single cleanup task
- Every follow-up task must include owner and due date
- Dry-run approval does not imply production rollout approval
- Production rollout approval is a separate decision with its own task

---

## References

| Resource | Path |
|---|---|
| Evidence template | `docs/operations/authjs-request-context-staging-validation-evidence-template.md` |
| Staging rollout plan | `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` |
| Google OAuth smoke test runbook | `docs/operations/authjs-google-oauth-smoke-test-runbook.md` |
| TASK-0039 authenticated resolver | `docs/checkpoints/TASK-0039-authjs-authenticated-request-context-resolver.md` |
| TASK-0040 tenant resolver | `docs/checkpoints/TASK-0040-authjs-tenant-request-context-resolver.md` |
| TASK-0041 smoke tests | `docs/checkpoints/TASK-0041-authjs-request-context-protected-handler-smoke-tests.md` |
| TASK-0042 rollout plan | `docs/checkpoints/TASK-0042-authjs-request-context-staging-rollout-observability-plan.md` |
| TASK-0043 evidence template | `docs/checkpoints/TASK-0043-authjs-request-context-staging-validation-evidence-template.md` |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-16 | Initial checklist — TASK-0044 |
