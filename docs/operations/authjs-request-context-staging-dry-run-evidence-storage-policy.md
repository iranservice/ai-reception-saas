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
