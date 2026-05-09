# Service Blueprint

## Actors

- **Business owner** — creates and manages the business workspace
- **Admin** — configures business settings, manages team members and access
- **Operator / receptionist** — handles customer conversations, writes responses
- **Customer / visitor** — sends inbound messages and receives responses
- **AI receptionist** — future assistant that prepares draft responses (not a human user, not implemented in MVP)
- **System / automation worker** — background processes for message routing, audit logging, scheduled tasks (not a human user)

## Frontstage Experience

What the user-facing actors see and do:

1. Customer sends message through a supported channel
2. Operator sees conversation queue with pending conversations
3. Operator opens a conversation and views customer context
4. Operator replies manually to the customer
5. Future: AI draft may assist operator by preparing a response for review (not implemented in MVP)

## Backstage System Responsibilities

What the system does behind the scenes:

1. Resolve tenant context from the authenticated session
2. Link or create customer record from inbound message identity
3. Create or update conversation thread
4. Store message with sender, content, and timestamp
5. Enforce authorization (membership, role, tenant scope)
6. Record audit-relevant actions (sensitive operations, state changes)

## Operator Workflow

1. View conversation queue (filtered by status, assignment)
2. Inspect customer context (profile, history, notes)
3. Write response to the customer
4. Optionally use future AI draft (future — not implemented in MVP)
5. Send response
6. Close or classify conversation

## Customer Workflow

1. Send message through a supported channel
2. Receive business response
3. Continue conversation if needed
4. Provide clarification if identity is uncertain

## AI-Assisted Workflow

**Future only — not implemented in MVP:**

1. AI prepares draft response based on conversation context and business knowledge
2. Operator reviews the AI draft
3. Operator edits or rejects the draft
4. Operator sends the approved response

AI must not auto-send in MVP. All AI-generated content must be reviewed by a human operator before delivery.

## Failure Modes

| Failure | Impact | Mitigation |
|---|---|---|
| AI unavailable | AI draft not generated | Operator continues manually — no workflow disruption |
| Provider unavailable | Channel delivery fails | Message queued for retry — operator notified |
| Message delivery failed | Customer does not receive response | Retry logic with failure logging |
| Customer identity uncertain | Customer record may be duplicated | System flags uncertain matches for operator review |
| Operator sends incorrect response | Customer receives wrong information | Audit trail preserves full history for correction |
| Tenant isolation risk | Data leak between businesses | RLS enforcement, tenant-scoped queries, security tests |

## Manual Override Points

- Operator can override AI draft at any time
- Admin can disable AI assistance for the business
- Operator can manually classify or reclassify a conversation
- Admin can review audit logs for any conversation or action

## Service Quality Principles

- **Human review before automation** — AI assists, humans decide
- **Tenant isolation by default** — all data is tenant-scoped
- **Traceability for sensitive actions** — audit trail for compliance
- **Provider-neutral architecture** — no vendor lock-in in core domains
- **Graceful degradation** — system works without AI or external providers
