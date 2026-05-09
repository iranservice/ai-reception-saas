# Domain Boundaries

## Purpose

Define planning boundaries for the existing domain scaffolds before implementation begins.

## Boundary Principles

- Domain owns its data
- Domain exposes service interface
- No direct cross-domain database access
- Tenant context must be explicit
- Audit-relevant actions must be traceable
- External providers are adapters, not core domain logic
- AI is assistant first, not autonomous actor by default

## Domain Map

The following 18 domain folders exist under `src/domains/` as scaffold-only (README + empty directory):

| # | Domain | Folder | Status |
|---|---|---|---|
| 1 | Identity | `identity/` | Scaffold only |
| 2 | Tenancy | `tenancy/` | Scaffold only |
| 3 | Authz | `authz/` | Scaffold only |
| 4 | CRM | `crm/` | Scaffold only |
| 5 | Channels | `channels/` | Scaffold only |
| 6 | Conversations | `conversations/` | Scaffold only |
| 7 | Routing | `routing/` | Scaffold only |
| 8 | AI Runtime | `ai-runtime/` | Scaffold only |
| 9 | Knowledge | `knowledge/` | Scaffold only |
| 10 | AI Config | `ai-config/` | Scaffold only |
| 11 | Actions | `actions/` | Scaffold only |
| 12 | Orders | `orders/` | Scaffold only |
| 13 | Reservations | `reservations/` | Scaffold only |
| 14 | Cases | `cases/` | Scaffold only |
| 15 | Approvals | `approvals/` | Scaffold only |
| 16 | Audit | `audit/` | Scaffold only |
| 17 | Billing | `billing/` | Scaffold only |
| 18 | Analytics | `analytics/` | Scaffold only |

## Domain Ownership

### Identity

Owns platform user identity. Responsible for user accounts, authentication triggers, session management, and user status tracking. Root domain with no upstream dependencies.

### Tenancy

Owns business workspace and membership context. Responsible for business entities, business configuration, user-business membership associations, teams, and operational groupings. Depends on Identity for user resolution.

### Authz

Owns permission decisions. Responsible for role definitions, permission definitions, role-permission mappings, and access control enforcement. Depends on Identity and Tenancy for user and membership context.

### CRM

Owns customer records. Responsible for tenant-scoped customer profiles, customer channel identities, customer notes and tags, and customer identity resolution from inbound messages. Depends on Identity and Tenancy.

### Channels

Owns external channel adapter configuration. Responsible for channel definitions, provider adapter contracts, inbound event ingestion, outbound delivery abstraction, and integration logs. Depends on Identity and Tenancy. Must not own conversation state.

### Conversations

Owns conversation and message state. Responsible for conversation lifecycle, message persistence, conversation notes and tags, and inbox-ready query views. Depends on Identity, Tenancy, CRM, and Channels.

### Routing

Owns assignment and ownership decisions. Responsible for conversation ownership state, assignment logic (manual, auto, round-robin), transfer and takeover, release-to-AI handoff, and ownership history. Depends on Identity, Tenancy, and Conversations.

### AI Runtime

Owns future AI execution orchestration. Responsible for AI reply trigger flow, provider adapter abstraction, AI interaction logs, retrieval logs, and AI handoff pre-checks. Depends on Identity, Tenancy, Conversations, Knowledge, and AI Config. Not implemented in MVP.

### Knowledge

Owns business knowledge sources. Responsible for knowledge base definitions, knowledge entries (FAQ, menu, services), entry versioning, and knowledge search. Depends on Identity and Tenancy.

### AI Config

Owns AI configuration and policy. Responsible for prompt templates, AI behavior policies, prompt versioning, and AI personality configuration. Depends on Identity and Tenancy.

### Actions

Owns future action orchestration. Responsible for action definitions, business action configurations, action execution orchestration, and handler registry. Depends on Identity, Tenancy, Conversations, and AI Runtime. Not implemented in MVP.

### Orders

Future vertical domain. Owns order lifecycle, order items, pricing, and refund foundations. Not implemented in MVP.

### Reservations

Future vertical domain. Owns reservation lifecycle, availability management, and booking confirmation. Not implemented in MVP.

### Cases

Future vertical domain. Owns support tickets, callback requests, and escalation workflows. Not implemented in MVP.

### Approvals

Owns future approval workflows. Responsible for approval requests, approval decisions, and approval lifecycle management. Not implemented in MVP.

### Audit

Owns audit records. Responsible for immutable audit trail, sensitive operation logs, before/after state diffs, and actor/time/target metadata. Depends on Identity and Tenancy for actor resolution.

### Billing

Owns future subscription/usage billing. Responsible for subscription plans, usage ledgers, billing summaries, and payment processing foundations. Not implemented in MVP.

### Analytics

Owns future reporting views. Responsible for conversation counts, AI response metrics, order metrics, and operational dashboard data. Not implemented in MVP.

## Allowed Dependencies

- Application services may call domain services
- Domains may reference stable identifiers from other domains
- Cross-domain interaction must go through service boundaries
- All domains may import from `src/lib/` (shared kernel: errors, types, prisma)

## Forbidden Dependencies

- Conversations must not depend directly on provider SDKs
- AI Runtime must not write customer records directly without going through CRM service boundary
- Channels must not own conversation state
- Billing must not own tenant identity
- Analytics must not become source of truth for operational data

## Cross-Domain Communication Rules

- Use service interfaces for cross-domain data access
- Avoid direct database access across domain boundaries
- Preserve tenant context in all cross-domain calls
- Emit audit-relevant events where needed
- Avoid circular dependencies between domains

## Domain-by-Domain Responsibilities

### Identity
- User CRUD
- Authentication triggers
- Session management
- User status tracking

### Tenancy
- Business CRUD
- Business membership management
- Business configuration
- Team management

### Authz
- Role definitions and assignments
- Permission checks
- Policy rule enforcement
- Access control decisions

### CRM
- Customer profile management
- Customer identity resolution
- Customer notes and tags
- Customer channel identity linking

### Channels
- Channel definitions and configuration
- Inbound event ingestion
- Outbound delivery abstraction
- Provider adapter contracts
- Integration logging

### Conversations
- Conversation CRUD and lifecycle
- Message persistence
- Conversation notes and tags
- Inbox query views

### Routing
- Conversation ownership management
- Assignment logic
- Transfer and takeover
- Release-to-AI handoff
- Ownership history

### AI Runtime
- AI reply trigger flow (future)
- Provider adapter abstraction (future)
- AI interaction logging (future)
- Retrieval logging (future)

### Knowledge
- Knowledge base management
- Knowledge entry CRUD
- Entry versioning
- Knowledge search

### AI Config
- Prompt template management
- AI policy management
- Prompt versioning
- AI personality configuration

### Actions
- Action definition management (future)
- Action execution orchestration (future)
- Handler registry (future)

### Audit
- Audit entry creation (append-only)
- Sensitive action logging
- Actor/tenant/action/target metadata

### Billing
- Subscription management (future)
- Usage ledger (future)
- Invoice generation (future)

### Analytics
- Metric aggregation (future)
- Dashboard data (future)

## Deferred Domains

The following domains are documented as future only and must not be implemented until their prerequisites exist:

| Domain | Prerequisites | Status |
|---|---|---|
| Orders | CRM, Conversations, Actions | Future |
| Reservations | CRM, Tenancy | Future |
| Cases | Conversations, Authz | Future |
| Approvals | Authz, Tenancy | Future |
| Billing | Tenancy, Identity | Future |
| Analytics | Conversations, Routing, Orders | Future |

## Anti-Coupling Rules

- No provider SDKs inside core conversation domain
- No AI Runtime dependency inside CRM
- No billing logic inside Tenancy
- No analytics mutation of source data
- No direct writes across domain boundaries
- No client-only enforcement of security, money, or state transitions
