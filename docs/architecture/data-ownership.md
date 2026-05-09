# Data Ownership

## Purpose

Define planned data ownership before Prisma models are introduced.

## Ownership Principles

- Every core entity has exactly one owning domain
- Tenant-owned data must be tenant-scoped
- Public endpoints must never trust client-provided internal tenant IDs
- Operator access must be membership-scoped
- Cross-tenant reads are security bugs
- Audit records must preserve tenant context

## Planned Core Entities

The following entities are planned only. No Prisma models are created in this task.

- **Business / Tenant** — the multi-tenant workspace entity
- **User** — platform user account
- **Membership** — user-business association with role
- **Customer** — end-customer profile, tenant-scoped
- **Conversation** — message thread between customer and business
- **Message** — individual message within a conversation
- **AI Draft** — future AI-generated draft response for operator review
- **Operator Reply** — operator-authored response message
- **Channel Account** — business channel configuration (e.g., WhatsApp number)
- **Channel Message** — raw channel-specific message record
- **Audit Event** — immutable audit log entry
- **Knowledge Source** — business knowledge base entry
- **Billing Account** — future subscription/billing record

## Entity Ownership Table

| Planned Entity | Owning Domain | Notes |
|---|---|---|
| Business / Tenant | tenancy | Planned only |
| User | identity | Planned only |
| Membership | tenancy | Planned only |
| Customer | crm | Planned only |
| Conversation | conversations | Planned only |
| Message | conversations | Planned only |
| AI Draft | ai-runtime | Planned only — future |
| Operator Reply | conversations | Planned only |
| Channel Account | channels | Planned only |
| Channel Message | channels | Planned only |
| Audit Event | audit | Planned only |
| Knowledge Source | knowledge | Planned only |
| Billing Account | billing | Future only |

## Tenant Isolation Rules

- All business data must be tenant-scoped
- Public endpoints must never trust client-provided internal tenant IDs
- Operator access must be membership-scoped
- Cross-tenant reads are security bugs
- Audit records must preserve tenant context
- Tenant context must be resolved from authenticated session, not from request parameters

## Audit Rules

- Sensitive changes must be traceable
- Audit entries must include actor, tenant, action, target, and timestamp
- Audit records must not be used as operational source of truth
- Audit entries are immutable — no updates or deletes
- System-initiated actions must be distinguishable from human-initiated actions

## PII Handling Rules

- Customer contact data (phone, email, name) is PII
- PII must be tenant-scoped
- Avoid exposing PII in application logs
- Future AI prompts must avoid unnecessary PII exposure
- Internal notes must never be exposed to customers or public APIs

## Data Lifecycle Notes

- Retention rules are not implemented yet
- Deletion/anonymization policy is not implemented yet
- Backup policy is not implemented yet
- Soft-delete strategy is planned but not implemented yet

## Not Implemented Yet

- Prisma models
- Migrations
- RLS policies
- Audit table
- Billing table
- Provider message tables
- Knowledge embedding tables
- Analytics aggregation tables
