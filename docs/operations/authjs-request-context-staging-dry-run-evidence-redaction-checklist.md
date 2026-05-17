# Auth.js Request-Context Staging Dry-Run Evidence Redaction Checklist

## Status

Checklist only. No evidence redacted.

## Purpose

Define a repeatable checklist for verifying that future Auth.js request-context staging dry-run evidence has been redacted before storage, review, or sharing.

## Non-Goals

- No real evidence redaction in this task
- No evidence storage in this task
- No preflight execution in this task
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
- No redaction tooling or scripts added

---

## Redaction Roles

| Role | Responsibility |
|---|---|
| Operator | Performs first-pass redaction before storage |
| Reviewer | Verifies redaction before review approval |
| CTO / System Designer | Resolves redaction policy exceptions |
| Incident Owner | Owns incident exception evidence handling |
| Product / Owner | Receives summary-only evidence if needed |

---

## Redaction Workflow

1. Operator captures evidence during dry-run execution.
2. Operator removes prohibited values (see "Must Never Appear").
3. Operator masks restricted identifiers (see "Must Mask Or Minimize").
4. Operator runs manual pattern search (see "Manual Pattern Search").
5. Operator stores redacted evidence in approved location.
6. Reviewer performs second-pass redaction check using this checklist.
7. Reviewer records pass/fail for each section.
8. Any failure creates follow-up or incident action.
9. CTO approves policy exceptions if needed.

---

## Must Never Appear

Verify none of the following appear anywhere in the evidence pack:

- [ ] `AUTH_SECRET` value
- [ ] `AUTH_GOOGLE_SECRET` value
- [ ] `GOOGLE_CLIENT_SECRET` value
- [ ] Session cookies
- [ ] `Set-Cookie` header values
- [ ] `Cookie` request header values
- [ ] `Authorization` header values
- [ ] JWT strings
- [ ] OAuth access tokens
- [ ] OAuth refresh tokens
- [ ] OAuth id tokens
- [ ] OAuth callback `code=` value
- [ ] OAuth callback `state=` value
- [ ] Full session object
- [ ] Full request headers
- [ ] Full response headers if they include cookies/tokens
- [ ] Private keys
- [ ] Service credentials
- [ ] Database connection strings
- [ ] Full table dumps

---

## Must Mask Or Minimize

Verify the following are masked or minimized to only what is necessary:

- [ ] Email addresses (use `j***@example.com` format)
- [ ] User names
- [ ] `userId` (use minimum necessary or `[TEST_USER_ID]`)
- [ ] `businessId` (use minimum necessary or `[TEST_BUSINESS_ID]`)
- [ ] `membershipId` (use minimum necessary or `[TEST_MEMBERSHIP_ID]`)
- [ ] `requestId` / `correlationId` if policy requires
- [ ] IP addresses if not required
- [ ] Internal hostnames if policy requires
- [ ] Unrelated tenant/customer data
- [ ] Deployment platform identifiers if policy requires

---

## Safe To Retain If Reviewed

Verify the following are present only after review and confirmation they contain no prohibited data:

- [ ] HTTP status codes
- [ ] Expected error codes (e.g., `AUTHJS_RUNTIME_DISABLED`, `AUTH_CONTEXT_UNAVAILABLE`)
- [ ] Redacted response body excerpts
- [ ] Route paths (e.g., `/api/auth/session`, `/api/businesses`)
- [ ] Request methods (GET, POST, etc.)
- [ ] Timestamps
- [ ] Deployment commit SHA
- [ ] Deployment ID
- [ ] Database row counts
- [ ] Table/column existence confirmations
- [ ] Selected test IDs only if policy allows
- [ ] Redacted screenshots
- [ ] Redacted log excerpts
- [ ] Metrics/dashboard screenshots without unrelated customer data

---

## HTTP Evidence Redaction

| Item | Action | Pass/Fail | Notes |
|---|---|---|---|
| `Cookie` request header | Remove entirely | TBD | TBD |
| `Authorization` request header | Remove entirely | TBD | TBD |
| `Set-Cookie` response header | Remove entirely | TBD | TBD |
| OAuth callback query string | Remove `code=` and `state=` values | TBD | TBD |
| Response body | Keep only expected fields | TBD | TBD |
| Error body | Keep code/message only | TBD | TBD |
| Redirect location | Remove sensitive query params | TBD | TBD |
| Route path | May keep | TBD | TBD |
| Status code | May keep | TBD | TBD |

---

## Log Evidence Redaction

| Item | Action | Pass/Fail | Notes |
|---|---|---|---|
| Authorization headers | Remove entirely | TBD | TBD |
| Cookie headers | Remove entirely | TBD | TBD |
| JWT-like strings | Remove entirely | TBD | TBD |
| OAuth token strings | Remove entirely | TBD | TBD |
| Full session serialization | Remove entirely | TBD | TBD |
| Secret-looking env vars | Remove entirely | TBD | TBD |
| Email addresses | Mask | TBD | TBD |
| Request IDs | Keep or mask per policy | TBD | TBD |
| Route paths | May keep | TBD | TBD |
| Error codes | May keep | TBD | TBD |

---

## Screenshot Redaction

| Area | Action | Pass/Fail | Notes |
|---|---|---|---|
| Browser address bar | Inspect for OAuth `code=`/`state=` | TBD | TBD |
| DevTools Application/Cookies | Do not include | TBD | TBD |
| Request headers panel | Remove/crop | TBD | TBD |
| Response headers panel | Remove/crop if cookies visible | TBD | TBD |
| Session payload display | Remove/crop | TBD | TBD |
| Email/user identity | Mask | TBD | TBD |
| Unrelated tenant/customer data | Mask | TBD | TBD |
| OAuth provider screens | Mask email/account details | TBD | TBD |
| Metrics dashboards | Mask unrelated data | TBD | TBD |

---

## Database Evidence Redaction

| Item | Action | Pass/Fail | Notes |
|---|---|---|---|
| `SELECT *` output | Not allowed | TBD | TBD |
| Full `User` rows | Not allowed | TBD | TBD |
| Full `Account` rows | Not allowed | TBD | TBD |
| Full `Session` rows | Not allowed | TBD | TBD |
| Email values | Mask | TBD | TBD |
| Provider tokens | Not allowed | TBD | TBD |
| Row counts | Allowed | TBD | TBD |
| Table existence | Allowed | TBD | TBD |
| Selected test role/status | Allowed | TBD | TBD |

---

## File Name Redaction

| Check | Expected | Pass/Fail | Notes |
|---|---|---|---|
| No email in filename | Yes | TBD | TBD |
| No business name in filename | Yes | TBD | TBD |
| No token fragment in filename | Yes | TBD | TBD |
| No secret name/value in filename | Yes | TBD | TBD |
| Includes date | Yes | TBD | TBD |
| Includes environment | Yes | TBD | TBD |

---

## Manual Pattern Search

Run these commands locally against the evidence directory before submission. These are template commands only — do not run them against real evidence in this task.

```bash
# Search for secret names/values
grep -RniE 'AUTH_SECRET|AUTH_GOOGLE_SECRET|GOOGLE_CLIENT_SECRET' "$EVIDENCE_DIR" || true

# Search for cookie/auth headers
grep -RniE 'session-token|Set-Cookie|Cookie:|Authorization:' "$EVIDENCE_DIR" || true

# Search for OAuth tokens
grep -RniE 'access_token|refresh_token|id_token|code=|state=' "$EVIDENCE_DIR" || true

# Search for JWT-like strings (base64url segments)
grep -RniE 'eyJ[A-Za-z0-9_-]+' "$EVIDENCE_DIR" || true

# Search for connection strings
grep -RniE 'postgres://|mysql://|mongodb://' "$EVIDENCE_DIR" || true

# Search for private key markers
grep -RniE 'BEGIN.*PRIVATE KEY|BEGIN.*SECRET' "$EVIDENCE_DIR" || true
```

### Expected Result

All commands should return **no matches**. Any match indicates redaction was incomplete.

| Pattern | Matches Found | Action Taken | Pass/Fail |
|---|---|---|---|
| Secret names/values | TBD | TBD | TBD |
| Cookie/auth headers | TBD | TBD | TBD |
| OAuth tokens | TBD | TBD | TBD |
| JWT-like strings | TBD | TBD | TBD |
| Connection strings | TBD | TBD | TBD |
| Private key markers | TBD | TBD | TBD |

---

## Redaction Summary

| Section | Items Checked | Pass | Fail | Notes |
|---|---|---|---|---|
| Must Never Appear | 20 | TBD | TBD | TBD |
| Must Mask Or Minimize | 10 | TBD | TBD | TBD |
| HTTP Evidence | 9 | TBD | TBD | TBD |
| Log Evidence | 10 | TBD | TBD | TBD |
| Screenshot | 9 | TBD | TBD | TBD |
| Database Evidence | 9 | TBD | TBD | TBD |
| File Names | 6 | TBD | TBD | TBD |
| Manual Pattern Search | 6 | TBD | TBD | TBD |
| **Total** | **79** | TBD | TBD | TBD |

### Redaction Outcome

| Field | Value |
|---|---|
| Redaction Date | TBD |
| Operator | TBD |
| Reviewer | TBD |
| Overall Result | PASS / FAIL |
| Follow-Up Actions | TBD |
| Exception Requests | TBD |

---

## References

| Resource | Path |
|---|---|
| Evidence storage policy | `docs/operations/authjs-request-context-staging-dry-run-evidence-storage-policy.md` |
| Evidence template | `docs/operations/authjs-request-context-staging-validation-evidence-template.md` |
| Evidence review checklist | `docs/operations/authjs-request-context-staging-dry-run-evidence-review-checklist.md` |
| Operator packet | `docs/operations/authjs-request-context-staging-dry-run-operator-packet.md` |
| Execution guide | `docs/operations/authjs-request-context-staging-dry-run-execution-guide.md` |
| Readiness sign-off template | `docs/operations/authjs-request-context-staging-dry-run-readiness-signoff-template.md` |
| Preflight command checklist | `docs/operations/authjs-request-context-staging-dry-run-preflight-command-checklist.md` |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-17 | Initial evidence redaction checklist — TASK-0050 |
