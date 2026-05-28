# TASK-R3 — Manual Channel Backend Sufficiency Design Approved

**Status:** R3A_MANUAL_CHANNEL_BACKEND_SUFFICIENCY_CHECKPOINT_READY
**Date:** 2026-05-28
**Main commit:** 855c79c

---

## 1. Purpose

Record CTO decision that R2 backend is sufficient to start R3 Manual Channel / Internal Intake.

- Current main commit: `855c79c`.
- R2 authenticated smoke and audit verification are complete (see `TASK-R2-api-handlers-staging-authenticated-smoke-verified.md`).
- R2 unauthenticated smoke verified (see `TASK-R2-api-handlers-staging-unauthenticated-smoke-verified.md`).
- R2 API handlers merged and staging-verified.
- R2 domain layer merged and staging migration deployed.
- All 1152 tests passing, 7 skipped (DB integration).

---

## 2. R3 Decision

| Gate | Decision | Status |
|---|---|---|
| **R3A** | Document backend sufficiency | ✅ This checkpoint |
| **R3B** | Dashboard/internal intake UI | Next — after R3A merge |
| **R3C** | Optional backend polish | Deferred — only if gap appears |

### R3A — Backend Sufficiency (This Checkpoint)

Formal record that R2 backend covers all R3 manual channel API requirements. No backend changes needed to start R3B frontend.

### R3B — Dashboard/Internal Intake UI (Next)

May proceed as frontend/dashboard implementation after R3A checkpoint is merged. Entirely frontend work — no backend changes required.

### R3C — Optional Backend Polish (Deferred)

- GET message by ID endpoint is not currently required for manual intake.
- VIEWER write-deny tests are useful hardening but not a blocker for R3B.
- Revisit R3C only if UI development or staging smoke exposes a backend gap.

### Audit-Policy Cleanup

The R2 architecture observation (initialMessage path does not emit separate `message.created` audit event) remains deferred and non-blocking. No action required unless separately approved by CTO.

---

## 3. Backend Sufficiency Summary

Existing R1/R2 backend already covers all manual channel operations:

### Conversation Operations (R2)

| Operation | Endpoint | Permission | Staging Verified |
|---|---|---|---|
| List conversations | `GET /api/businesses/:bid/conversations` | `conversations.read` | ✅ |
| Create conversation | `POST /api/businesses/:bid/conversations` | `conversations.reply` | ✅ |
| Create with initial message | Same endpoint, `initialMessage` body field | `conversations.reply` | ✅ |
| Get conversation detail | `GET /api/businesses/:bid/conversations/:cid` | `conversations.read` | ✅ |
| Update conversation | `PATCH /api/businesses/:bid/conversations/:cid` | `conversations.reply` | ✅ |
| Change status | `POST /api/businesses/:bid/conversations/:cid/status` | `conversations.reply` / `conversations.close` | ✅ |

### Message Operations (R2)

| Operation | Endpoint | Permission | Staging Verified |
|---|---|---|---|
| List messages | `GET /api/businesses/:bid/conversations/:cid/messages` | `messages.read` | ✅ |
| Create outbound message | `POST /api/businesses/:bid/conversations/:cid/messages` | `messages.create` | ✅ |
| Create internal note | Same endpoint, `direction: "INTERNAL"` | `messages.create` | ✅ |

### Customer Operations (R1 CRM)

| Operation | Endpoint | Permission |
|---|---|---|
| List/search customers | `GET /api/businesses/:bid/customers?search=` | `customers.read` |
| Create customer | `POST /api/businesses/:bid/customers` | `customers.update` |
| Find-or-create by contact | `POST /api/businesses/:bid/customers/resolve` | `customers.update` |
| Get customer detail | `GET /api/businesses/:bid/customers/:cid` | `customers.read` |

### Query Filters (R2)

| Filter | Parameter | Type |
|---|---|---|
| Conversation status | `?status=NEW\|OPEN\|ASSIGNED\|...` | Enum |
| Channel | `?channel=INTERNAL\|WEBSITE_CHAT` | Enum |
| Customer | `?customerId=<uuid>` | UUID |
| Assigned user | `?assignedUserId=<uuid>` | UUID |
| Message direction | `?direction=INBOUND\|OUTBOUND\|INTERNAL` | Enum |
| Pagination limit | `?limit=<1-100>` | Integer |
| Cursor | `?cursor=<uuid>` | UUID |

### Cross-Cutting Concerns

| Concern | Status |
|---|---|
| Tenant boundary enforcement | ✅ businessId + membership verified on every request |
| Role-based authz (OWNER/ADMIN/OPERATOR/VIEWER) | ✅ Permission checked before every operation |
| Anti-impersonation (senderUserId from auth context) | ✅ Handler derives sender, not client body |
| SYSTEM direction rejected at API boundary | ✅ `API_MESSAGE_DIRECTIONS` excludes SYSTEM |
| Customer tenant integrity | ✅ `verifyCustomerInBusiness` before linking |
| Audit trail without message content leakage | ✅ Audit records action/target/result only |
| Cursor-based pagination | ✅ All list endpoints |
| State machine enforcement | ✅ Full lifecycle: NEW→OPEN→ASSIGNED→…→RESOLVED |

---

## 4. Explicit Exclusions

R3A/R3B must **not** include any of the following:

| Excluded Scope | Reason |
|---|---|
| WhatsApp integration | External channel — out of R3 scope |
| Instagram integration | External channel — out of R3 scope |
| SMS integration | External channel — out of R3 scope |
| Voice integration | External channel — out of R3 scope |
| Website widget frontend | Widget — out of R3 scope |
| AI classification runtime | AI scope — out of R3 scope |
| AI draft generation | AI scope — out of R3 scope |
| AI auto-reply | AI scope — out of R3 scope |
| Assignment/routing engine | Deferred to R4 (requires membership verification) |
| Booking/actions/leads/billing | Product scope — not R3 |
| Service catalog/order foundation | Product scope — not R3 |
| External inbound webhooks | External channel — not R3 |
| Audit-policy cleanup | Deferred — non-blocking unless separately approved |

---

## 5. R3B Readiness

R3B may proceed as frontend/dashboard implementation after this R3A checkpoint is merged.

**R3B scope (frontend only):**
- Conversation list page with filters (status, channel, customer)
- Conversation detail page (messages, compose, internal notes)
- New conversation form (channel, subject, initial message)
- Customer linking/search integration
- Status transition controls
- No backend changes required

**R3B prerequisites:**
- R3A checkpoint merged ✅ (this document)
- Staging API verified via R2 authenticated smoke ✅
- All R2 endpoints available and feature-flagged ON ✅

---

## 6. R3C Deferred

| Item | Status | Rationale |
|---|---|---|
| GET message by ID endpoint | Deferred | Not required for manual intake. List messages covers primary use case. |
| VIEWER write-deny handler tests | Deferred | Authz enforcement is correct. Tests are hardening, not a blocker. |
| Revisit trigger | Only if R3B UI/smoke exposes a backend gap | — |

---

## 7. Safety

| Check | Status |
|---|---|
| Docs-only change | ✅ |
| No schema changes | ✅ |
| No migration changes | ✅ |
| No source code changes | ✅ |
| No staging touched | ✅ |
| No secrets in document | ✅ |
| No IDs in document | ✅ |
| No R3B implementation started | ✅ |
| No R3C implementation started | ✅ |
| No R4 started | ✅ |
| No AI/channel/widget scope | ✅ |

---

## 8. Final Status

```
R3A_MANUAL_CHANNEL_BACKEND_SUFFICIENCY_CHECKPOINT_READY
```

### Next Steps

1. Merge this checkpoint.
2. CTO approves R3B start (dashboard/internal intake UI).
3. R3C revisited only if R3B exposes a backend gap.
4. Do not start R4 until R3 gate is closed.
