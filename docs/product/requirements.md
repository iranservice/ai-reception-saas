# Product Requirements

## Product Summary

AI Reception SaaS is a multi-tenant B2B platform for AI-assisted customer reception, triage, routing, and operator workflows.

## Problem Statement

Small and service-oriented businesses lose customer opportunities because inbound messages are fragmented, manual, slow, and hard to track.

## Target Customers

- Small service businesses
- Clinics and appointment-based businesses
- Maintenance/service companies
- Restaurants or reservation-heavy businesses
- Local agencies
- Ecommerce/customer support teams

## Primary Users

- **Business owner** — creates and manages the business workspace
- **Admin** — configures business settings, manages team members
- **Operator / receptionist** — handles customer conversations, writes responses
- **Customer / visitor** — sends inbound messages and receives responses
- **AI receptionist** — future assistant that prepares draft responses for operator review (not a human user)
- **System / automation worker** — background processes for message routing, audit logging, scheduled tasks (not a human user)

## Core Value Proposition

Centralize inbound customer communication, preserve customer context, help operators respond faster, and prepare a safe foundation for future AI-assisted drafting.

## MVP Goals

- Capture inbound customer messages
- Organize conversations for operators
- Support business-owned customer records
- Prepare for AI-assisted drafting (future — not implemented in MVP)
- Prepare for future channel adapters (future — not implemented in MVP)
- Maintain tenant isolation
- Avoid premature automation

## Non-Goals

- No AI auto-reply in MVP
- No WhatsApp/Twilio integration in MVP
- No payment/billing implementation in MVP
- No realtime chat in MVP
- No attachments in MVP
- No advanced analytics in MVP
- No multi-region deployment work in MVP

## Key User Journeys

1. **Business configures reception settings** — owner or admin sets up business workspace, invites operators, configures basic settings
2. **Customer sends inbound message** — customer initiates contact through a supported channel
3. **System creates or links customer record** — system resolves customer identity or creates a new record
4. **System creates conversation** — system creates a new conversation thread or continues an existing one
5. **Operator views conversation** — operator sees the conversation queue and opens a conversation
6. **Operator writes or reviews response** — operator composes a manual reply to the customer
7. **Future: AI draft assists operator** — AI prepares a draft response for the operator to review, edit, and approve before sending (future — not implemented in MVP)
8. **Admin reviews audit trail** — admin reviews audit log of sensitive actions for compliance and troubleshooting

## Functional Requirements

### FR-01: Tenant/Business Workspace Planning

- Platform supports multiple isolated business workspaces
- Each business has its own configuration, members, and data
- Business creation and management workflows are defined

### FR-02: Membership/Access Planning

- Users can belong to multiple businesses with different roles
- Roles control access to features and data within a business
- Membership lifecycle (invite, join, remove) is defined

### FR-03: Customer Record Planning

- Customer records are created per business (tenant-scoped)
- Customers are resolved or auto-created from inbound messages
- Customer identity can be linked across channels (future)

### FR-04: Conversation Planning

- Conversations represent threads between a customer and a business
- Conversations track status (open, assigned, resolved, closed)
- Conversations are scoped to a business and linked to a customer

### FR-05: Message Planning

- Messages are individual entries within a conversation
- Messages track sender, content, and timestamp
- Messages support both customer-originated and operator-originated content

### FR-06: Operator Workflow Planning

- Operators view a conversation queue filtered by status and assignment
- Operators can claim, respond to, and resolve conversations
- Operators can add internal notes to conversations

### FR-07: Future AI Draft Preparation

- AI draft preparation is a planned capability (future — not implemented in MVP)
- The architecture must support a future AI assistant that generates draft responses
- AI drafts must always be reviewed and approved by a human operator before sending
- AI must never auto-send responses without explicit human approval

### FR-08: Audit Baseline Planning

- Sensitive actions are logged with actor, tenant, action, target, and timestamp
- Audit records are immutable and tenant-scoped
- Audit trail supports future compliance and troubleshooting needs

## Non-Functional Requirements

### NFR-01: Tenant Isolation

- All business data must be tenant-scoped
- Cross-tenant data access is a security bug
- Tenant context must be resolved and enforced at the service layer

### NFR-02: Secure Access Control

- Authentication must be handled before any data access
- Authorization must be enforced server-side, not client-only
- Role-based access control must govern feature and data access

### NFR-03: Server-Side Authorization

- All permission checks must be server-enforced
- Client-side checks are for UX convenience only, never for security
- Money and state transitions must be server-enforced (future phases)

### NFR-04: Traceability

- Audit-relevant actions must be traceable to an actor and tenant
- Sensitive operations must be logged
- System actions must be distinguishable from human actions

### NFR-05: Testability

- Domain logic must be unit-testable without external dependencies
- Integration tests must validate cross-domain interactions
- Security-critical paths must have dedicated test coverage

### NFR-06: Maintainable Modular Monolith

- Domain modules must have clear boundaries and ownership
- Cross-domain access must go through service interfaces
- Domain modules must be independently testable

### NFR-07: Provider-Neutral Design

- Core domain logic must not depend on specific external providers
- Provider integrations must use adapter patterns
- Swapping providers must not require core domain changes

## Trust, Safety, and Privacy Requirements

- Public endpoints must not trust internal tenant IDs from clients
- Customer data must be tenant-scoped
- Internal notes must never be exposed to customers or public APIs
- Future AI output must be reviewable before any automation
- Audit-relevant actions must be traceable

## Success Metrics

- **Successful message capture rate** — percentage of inbound messages successfully stored
- **Conversation creation accuracy** — correct customer-conversation linking rate
- **Operator response workflow completion** — percentage of conversations that reach resolved/closed status
- **Tenant isolation test coverage** — percentage of data access paths with tenant isolation tests
- **Audit event coverage for sensitive actions** — percentage of sensitive actions with audit entries

## Open Questions

- First actual channel adapter (WhatsApp, web chat, or internal test channel?)
- Exact auth provider (magic link, OAuth, or both?)
- Onboarding flow (self-serve, admin-assisted, or both?)
- Localization priority (Persian/Farsi + English from day one, or English first?)
- Billing timing (which phase introduces billing?)
