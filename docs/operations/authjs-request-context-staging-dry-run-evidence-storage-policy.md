# Auth.js Request-Context Staging Dry-Run Evidence Storage Policy

## Status

Policy only. No evidence storage created.

## Purpose

Define storage, access, retention, redaction, and disposal rules for future Auth.js request-context staging dry-run evidence.

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
- No actual storage bucket/folder/tooling created
- No evidence files produced in this task

---

## Evidence Classification

| Evidence Type | Sensitivity | May Be Stored? | Required Handling |
|---|---|---|---|
| Completed evidence template | Internal | Yes | Approved storage only |
| Readiness sign-off | Internal | Yes | Approved storage only |
| HTTP response status/body excerpts | Internal | Yes | Redact secrets/cookies/tokens |
| Redacted screenshots | Internal | Yes | Mask emails/tokens/cookies |
| Log excerpts | Internal / Restricted | Yes if redacted | Remove secrets/session data |
| Metrics/dashboard screenshots | Internal | Yes | Mask unrelated customer data |
| Database query counts | Internal | Yes | No full table dumps |
| userId/businessId/membershipId | Internal / Restricted | Yes if policy allows | Record minimum necessary |
| Email address | Restricted | Avoid or mask | Redact/partial mask |
| Cookies/JWTs/OAuth tokens | Secret | **No** | Never store |
| AUTH_SECRET / GOOGLE_CLIENT_SECRET | Secret | **No** | Never store |
| Full session object | Restricted / Secret | **No** | Never store |
| Provider access/refresh/id tokens | Secret | **No** | Never store |

---

## Approved Storage Locations

| Location | Use | Owner | Access Model | Status |
|---|---|---|---|---|
| Approved internal docs folder | Final evidence pack | TBD | Least privilege | TBD |
| Approved incident/release folder | Rollback/incident notes | TBD | Restricted | TBD |
| GitHub repository `docs/` | Blank templates only | Repo maintainers | Normal repo access | Allowed for blank templates only |
| Local machine | Temporary capture only | Operator | Operator-only | Must be cleaned after transfer |
| Chat tools | Summaries only | Operator / Reviewer | Avoid sensitive data | No secrets ever |

### Storage Rules

1. **Completed evidence** must not be committed to the repository unless explicitly approved by CTO.
2. **Blank templates** may be committed to the repository.
3. **Redacted summaries** may be committed only if policy explicitly allows.
4. **Raw logs** must not be committed to the repository.
5. **Raw screenshots** must not be committed unless reviewed and redacted.
6. **Secret-containing files** must never be stored in any shared location.

---

## Evidence Naming Convention

Use date-stamped filenames to ensure uniqueness and traceability:

```text
authjs-request-context-staging-validation-evidence-YYYY-MM-DD.md
authjs-request-context-staging-readiness-signoff-YYYY-MM-DD.md
authjs-request-context-staging-review-checklist-YYYY-MM-DD.md
authjs-request-context-staging-logs-redacted-YYYY-MM-DD.txt
authjs-request-context-staging-metrics-redacted-YYYY-MM-DD.png
```

If multiple attempts occur on the same date, append a sequence number:

```text
authjs-request-context-staging-validation-evidence-YYYY-MM-DD-02.md
```

---

## Access Control

| Role | Evidence Read | Evidence Write | Evidence Delete | Sign-Off |
|---|---|---|---|---|
| Operator | Yes | Yes (own evidence) | No | Yes (own sections) |
| Reviewer | Yes | Yes (review sections) | No | Yes (review outcome) |
| Rollback Owner | Yes | Yes (rollback sections) | No | Yes (rollback readiness) |
| CTO / System Designer | Yes | Yes | Yes (after retention) | Yes (final approval) |
| Product / Owner | Summary only | No | No | Optional acknowledgement |
| External parties | No | No | No | N/A |

### Access Rules

1. Evidence access follows **least privilege** — only roles listed above may access.
2. **No external sharing** without explicit CTO approval.
3. **No forwarding** of unredacted evidence via email or chat.
4. **Summary-only** sharing with Product/Owner role.

---

## Redaction Requirements

### Must Be Redacted Before Storage

| Item | Redaction Method | Example |
|---|---|---|
| `AUTH_SECRET` | Remove entirely | `[REDACTED]` |
| `AUTH_GOOGLE_SECRET` | Remove entirely | `[REDACTED]` |
| `AUTH_GOOGLE_ID` | Partial mask | `12345...xxxxx` |
| Session cookies | Remove entirely | `[REDACTED]` |
| JWT values | Remove entirely | `[REDACTED]` |
| OAuth access/refresh/id tokens | Remove entirely | `[REDACTED]` |
| Full session object | Remove entirely | `[REDACTED]` |
| Email addresses | Partial mask | `j***@example.com` |
| Provider callback codes | Remove entirely | `[REDACTED]` |
| State/nonce parameters | Remove entirely | `[REDACTED]` |

### Redaction Verification

- [ ] Operator verifies redaction before submitting evidence
- [ ] Reviewer verifies redaction during review (TASK-0044, Section A)
- [ ] No `grep` for known secret patterns returns matches in final evidence

---

## Retention Policy

| Evidence Type | Minimum Retention | Maximum Retention | After Retention |
|---|---|---|---|
| Completed evidence template | 90 days | 1 year | Archive or dispose |
| Readiness sign-off | 90 days | 1 year | Archive or dispose |
| Review checklist (completed) | 90 days | 1 year | Archive or dispose |
| Redacted logs | 30 days | 90 days | Dispose |
| Redacted screenshots | 30 days | 90 days | Dispose |
| Metrics screenshots | 30 days | 90 days | Dispose |
| Local temporary files | 0 days (transfer immediately) | 7 days | Dispose |

### Retention Rules

1. Retention clock starts from the **dry-run completion date**.
2. CTO may extend retention if follow-up tasks require it.
3. After maximum retention, evidence must be **archived or disposed** per disposal rules.
4. **Local temporary files** must be transferred to approved storage within 24 hours and deleted from operator's machine within 7 days.

---

## Disposal Rules

1. **Soft disposal**: Move to archive folder with restricted access (CTO-only).
2. **Hard disposal**: Permanently delete from all storage locations.
3. **Disposal decision**: CTO determines soft vs. hard disposal.
4. **Disposal record**: Log the disposal date, method, and approver.
5. **No partial disposal**: Dispose the complete evidence pack, not individual files.
6. **Local cleanup**: Operator confirms local copies are deleted after transfer.

### Disposal Record Template

| Field | Value |
|---|---|
| Evidence Pack ID | TBD |
| Dry-Run Date | TBD |
| Disposal Date | TBD |
| Disposal Method | Soft archive / Hard delete |
| Approver | TBD |
| Confirmed By | TBD |

---

## Incident and Breach Handling

If evidence containing secrets or unredacted sensitive data is discovered:

1. **Immediately** notify the CTO and incident channel.
2. **Revoke** any exposed secrets (rotate AUTH_SECRET, AUTH_GOOGLE_SECRET).
3. **Remove** the compromised evidence from all storage locations.
4. **Produce** a cleaned, redacted replacement.
5. **Record** the incident in the evidence review decision record.
6. **Do not** continue the dry-run until secrets are rotated and confirmed.

---

## Directory Structure Recommendation

Recommended structure for evidence storage:

```text
authjs-request-context-staging-dry-run/
  YYYY-MM-DD/
    00-readiness-signoff/
    01-evidence-template/
    02-http-responses/
    03-logs-redacted/
    04-metrics-redacted/
    05-review-checklist/
    06-final-decision/
```

### Rules

1. Create a new date folder for each dry-run attempt.
2. Store each evidence type in the corresponding subfolder.
3. Do not mix evidence from different dry-run attempts in the same date folder.
4. Use the naming convention from the Evidence Naming Convention section.
5. The `06-final-decision/` folder contains the reviewer outcome and CTO sign-off.

---

## Screenshot Policy

### Allowed Screenshot Content

- HTTP response status codes and redacted bodies
- Application UI states (login page, error pages, success states)
- Dashboard/metrics panels (redacted)
- Database query result counts (not full rows)

### Prohibited Screenshot Content

- Browser cookie panels or DevTools showing cookie values
- Request headers containing session tokens or authorization headers
- Response bodies containing full JWT payloads or session objects
- Environment variable panels showing secret values
- OAuth consent screens showing full email addresses (must mask)

### Screenshot Handling

1. Review every screenshot before storing.
2. Mask or crop any prohibited content.
3. Use annotation tools to redact — do not rely on cropping alone if secret data might remain visible.
4. Name screenshots with the evidence naming convention.
5. Store in `04-metrics-redacted/` or the relevant stage subfolder.

---

## Log Excerpt Policy

### Allowed Log Content

- Timestamp, log level, and message text
- Request method and path (e.g., `GET /api/auth/session`)
- HTTP status codes
- Error codes and error messages (e.g., `AUTHJS_RUNTIME_DISABLED`)
- Request duration/latency values
- Feature flag evaluation results

### Prohibited Log Content

- Cookie header values
- Authorization header values
- JWT token strings
- OAuth token strings (access, refresh, id)
- Full session object serializations
- Secret values (AUTH_SECRET, AUTH_GOOGLE_SECRET)
- Full request/response bodies containing tokens

### Log Handling

1. Extract only the relevant log lines — do not dump entire log files.
2. Replace prohibited content with `[REDACTED]` inline.
3. Store redacted excerpts in `03-logs-redacted/`.
4. Maximum recommended log excerpt: 100 lines per stage.

---

## Database Evidence Policy

### Allowed Database Evidence

- Row counts (e.g., "Account table: 1 row matching test user")
- Column existence confirmations (e.g., "`emailVerified` column exists")
- Table existence confirmations
- Membership role and status values
- Query result counts from verification queries

### Prohibited Database Evidence

- Full table dumps
- Full row exports with all columns
- Password hashes or encrypted fields
- Email addresses (must be masked)
- Any column containing token or secret data

### Database Handling

1. Use `SELECT count(*)` or targeted single-row queries.
2. Mask email addresses in query results.
3. Never run `SELECT *` — specify only needed columns.
4. Store database evidence as text excerpts in the evidence template, not as separate CSV/SQL files.

---

## HTTP Evidence Policy

### Allowed HTTP Evidence

- Request method and URL path
- HTTP status code
- Response body error codes (e.g., `AUTHJS_RUNTIME_DISABLED`, `AUTH_CONTEXT_UNAVAILABLE`)
- Response `Content-Type` header
- Redirect location paths (without query parameters containing tokens)

### Prohibited HTTP Evidence

- `Cookie` request header values
- `Authorization` request header values
- `Set-Cookie` response header values
- Response bodies containing full JWT or session payloads
- OAuth callback URLs containing `code=` or `state=` parameter values
- Full `curl` commands that include `-H "Cookie: ..."` or `-H "Authorization: ..."`

### HTTP Handling

1. Use `curl -s -o /dev/null -w "%{http_code}"` for status-only checks.
2. Pipe JSON responses through `jq` to extract only the needed fields.
3. Replace token values with `[REDACTED]` in any stored curl output.
4. Store HTTP evidence in `02-http-responses/` or inline in the evidence template.

---

## Evidence Integrity

### Immutability

1. Once evidence is submitted for review, it must not be modified.
2. If corrections are needed, create a new version with a changelog note.
3. The reviewer must review the final, unmodified version.

### Completeness

1. Evidence must cover all stages executed (Stage 0–4).
2. Missing stage evidence must be documented with a reason.
3. Partial evidence packs are flagged during review (TASK-0044).

### Traceability

1. Every evidence file must reference the dry-run date and deployment commit SHA.
2. Every evidence file must reference the operator name.
3. The evidence template links to the specific checklist and sign-off used.

### Verification

- [ ] Evidence pack matches the directory structure recommendation
- [ ] All required stages have corresponding evidence
- [ ] No files have been modified after submission timestamp
- [ ] Deployment commit SHA is consistent across all evidence files

---

## Storage Workflow

```
┌─────────────────────────────────┐
│ 1. Operator creates date folder │
│    per directory structure       │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│ 2. Operator captures evidence   │
│    during dry-run execution     │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│ 3. Operator redacts all files   │
│    per redaction requirements   │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│ 4. Operator self-verifies       │
│    redaction (grep check)       │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│ 5. Operator transfers to        │
│    approved storage location    │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│ 6. Operator deletes local       │
│    copies within 7 days         │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│ 7. Reviewer accesses evidence   │
│    from approved storage        │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│ 8. Reviewer verifies redaction  │
│    and completeness             │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│ 9. CTO records final decision   │
│    in 06-final-decision/        │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│ 10. Evidence marked immutable   │
│     retention clock starts      │
└─────────────────────────────────┘
```

---

## Evidence Sharing Rules

| Sharing Scenario | Allowed? | Conditions |
|---|---|---|
| Operator → Reviewer (approved storage) | Yes | Redacted, via approved location only |
| Reviewer → CTO (approved storage) | Yes | Redacted, via approved location only |
| Anyone → Chat/Slack (summary only) | Yes | No secrets, no tokens, no cookies, no full evidence |
| Anyone → Chat/Slack (screenshots) | Conditional | Only if fully redacted and approved |
| Anyone → Email | Conditional | Only redacted summaries, never full evidence packs |
| Anyone → External parties | No | Never without explicit CTO approval |
| Anyone → Public channels | No | Never |

### Sharing Rules

1. **Default deny**: Evidence is not shared unless explicitly allowed above.
2. **Redaction first**: All shared content must be redacted before sharing.
3. **Approved channel only**: Use approved storage location for evidence transfer.
4. **No attachments in chat**: Do not attach evidence files in chat tools.
5. **Link, don't copy**: Share links to approved storage, not file copies.

---

## Incident Exception Handling

If an incident occurs during the dry-run that requires deviating from this policy:

### Allowed Exceptions

1. **Emergency rollback evidence**: May be captured without full redaction if immediate action is needed. Must be redacted within 24 hours.
2. **Incident channel sharing**: Unredacted status codes and error messages may be shared in the incident channel for coordination. No secrets.
3. **CTO override**: CTO may authorize temporary storage in a non-approved location during an active incident. Must be moved to approved storage within 48 hours.

### Exception Record

| Field | Value |
|---|---|
| Exception Date | TBD |
| Exception Type | Emergency rollback / Incident sharing / CTO override |
| Reason | TBD |
| Authorized By | TBD |
| Remediation Deadline | TBD |
| Remediation Completed | TBD |

### Rules

1. Every exception must be recorded.
2. Unredacted evidence stored under exception must be redacted or disposed within the remediation deadline.
3. CTO reviews all exceptions after the incident is resolved.

---

## Compliance Checklist

Before the evidence pack is considered complete, verify:

- [ ] All evidence stored in approved location
- [ ] Directory structure follows recommendation
- [ ] Naming convention followed for all files
- [ ] All secrets redacted (AUTH_SECRET, AUTH_GOOGLE_SECRET)
- [ ] All cookies/JWTs/OAuth tokens redacted
- [ ] All email addresses masked
- [ ] No full session objects stored
- [ ] No full table dumps stored
- [ ] Screenshots reviewed and redacted
- [ ] Log excerpts reviewed and redacted
- [ ] HTTP evidence reviewed and redacted
- [ ] Database evidence limited to counts/confirmations
- [ ] Evidence integrity verified (no post-submission modifications)
- [ ] Local copies deleted or scheduled for deletion
- [ ] Access control verified (only authorized roles have access)
- [ ] Retention policy acknowledged
- [ ] No evidence shared via unauthorized channels

---

## Open Questions

| Question | Owner | Status |
|---|---|---|
| Exact approved storage location (shared drive, wiki, private repo) | CTO / Ops | TBD — must be resolved before first dry-run |
| Whether redacted summaries may be committed to repository | CTO | TBD |
| Whether incident exception records should be stored with evidence or separately | CTO | TBD |
| Organizational data protection policy alignment review | CTO / Legal | TBD |

---

## Compliance Notes

- This policy applies to **staging dry-run evidence only**.
- Production evidence (if any future task requires it) will need a separate policy.
- This policy does not replace organizational data protection policies — it supplements them.
- If organizational policy conflicts with this document, organizational policy takes precedence.

---

## References

| Resource | Path |
|---|---|
| Evidence template | `docs/operations/authjs-request-context-staging-validation-evidence-template.md` |
| Evidence review checklist | `docs/operations/authjs-request-context-staging-dry-run-evidence-review-checklist.md` |
| Operator packet | `docs/operations/authjs-request-context-staging-dry-run-operator-packet.md` |
| Execution guide | `docs/operations/authjs-request-context-staging-dry-run-execution-guide.md` |
| Readiness sign-off template | `docs/operations/authjs-request-context-staging-dry-run-readiness-signoff-template.md` |
| Preflight command checklist | `docs/operations/authjs-request-context-staging-dry-run-preflight-command-checklist.md` |
| Rollout/observability plan | `docs/operations/authjs-request-context-staging-rollout-observability-plan.md` |

---

## Version History

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-05-17 | Initial evidence storage policy — TASK-0049 |
| 1.1 | 2026-05-17 | Added directory structure, screenshot/log/DB/HTTP policies, integrity, workflow, sharing, exception handling, compliance checklist, open questions |
