# MVP Scope

## MVP Principle

The MVP should validate internal conversation, customer, tenant, and operator workflow foundations before adding external providers or autonomous AI behavior.

## In Scope

Planning only — no implementation in this task:

- **Tenant/business model** — multi-tenant workspace isolation, business configuration
- **Membership/access model** — user-business association, role-based access
- **Customer record model** — tenant-scoped customer profiles, identity resolution
- **Conversation model** — conversation lifecycle, status tracking, customer linking
- **Message model** — message persistence, sender tracking, content storage
- **Operator workflow** — conversation queue, claim/respond/resolve flow, internal notes
- **AI draft preparation** — architecture readiness for future AI-assisted drafting (not implemented)
- **Audit baseline** — sensitive action logging, actor/tenant/action traceability

## Out of Scope

The following are explicitly excluded from the MVP:

- AI auto-send
- Provider integrations
- WhatsApp
- Twilio
- Email sending
- SMS sending
- Voice
- Billing
- Realtime
- Attachments
- Complex analytics
- Marketplace
- Mobile app

## Phase Boundaries

- Phase 0 is planning and architecture.
- Implementation must start with tenant, identity, and access model design.
- Conversation and message models must exist before external channels.
- Human review workflow must exist before AI drafting.
- AI drafting must exist before any AI auto-reply decision.

## MVP Acceptance Criteria

- Tenant boundaries are defined
- Access model is defined
- Customer/conversation/message model is designed
- Operator workflow is defined
- Audit baseline is defined
- No provider SDK is required for MVP foundation

## Deferred Capabilities

The following capabilities are planned for future phases:

| Capability | Phase | Dependency |
|---|---|---|
| WhatsApp/Twilio | Future | Conversation model must exist first |
| Email/SMS sending | Future | Channel adapter pattern must exist first |
| AI auto-reply | Future | Human review workflow must exist first |
| Realtime | Future | Async conversation workflow must be validated first |
| Billing | Future | Tenant and membership model must exist first |
| Attachments | Future | Message model must exist first |
| Advanced analytics | Future | Core domain data must exist first |

## Explicit Anti-Scope Rules

- Do not implement provider integrations before internal conversation model exists.
- Do not implement AI auto-reply before human review workflow exists.
- Do not implement billing before tenant and membership model exists.
- Do not implement realtime before async conversation workflow is validated.
- Do not add external SDKs without explicit task authorization.
