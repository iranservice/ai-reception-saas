# TASK-0005: Tenant and Identity Prisma Schema Design

## Summary

Designed the first planned Prisma schema slice for users, sessions, businesses, memberships, access-control concepts, and audit events. Established project-level Prisma schema conventions.

## Files Created

- docs/architecture/tenant-identity-prisma-schema-design.md
- docs/architecture/prisma-schema-conventions.md
- docs/checkpoints/TASK-0005-tenant-identity-prisma-schema-design.md

## Files Modified

None.

## Schema Design Decisions

- 6 enums designed: UserStatus, BusinessStatus, MembershipStatus, MembershipRole, AuditActorType, AuditResult
- 5 Prisma models designed with full field specs: User, Session, Business, BusinessMembership, AuditEvent
- All models use UUID primary keys via `@default(uuid()) @db.Uuid`
- All models use `@@map` for snake_case table names
- All foreign key fields use `@map` for snake_case columns
- Illustrative Prisma snippets included as documentation only

## Entity Decisions

- **User**: global identity, not tenant-scoped, status-based lifecycle
- **Session**: app-owned session with hashed token, revocation via `revokedAt`
- **Business**: tenant root entity with slug, timezone, locale, status lifecycle
- **BusinessMembership**: links User to Business with role and status, `@@unique([userId, businessId])`
- **AuditEvent**: append-only audit trail with actor, tenant, action, target, result, and metadata

## Deferred Decisions

- **Role table**: deferred — using MembershipRole enum for MVP
- **Permission table**: deferred — using hardcoded permission map for MVP
- **RolePermission table**: deferred — not needed until Role and Permission become tables
- **PolicyRule table**: deferred — ABAC and custom policy rules are future scope
- **Membership history**: deferred — using single-row status updates with audit events for history
- **Custom roles**: deferred — MVP uses fixed role set
- **Partial indexes**: deferred — may be needed later for active-only membership uniqueness

## Prisma Convention Decisions

- Models use PascalCase, tables use snake_case plural via `@@map`
- Fields use camelCase, columns use snake_case via `@map`
- UUIDs for all primary keys, no autoincrement
- Timestamps: `createdAt` + `updatedAt` on all mutable models, `createdAt` only on append-only models
- Enums for stable lifecycle states, SCREAMING_SNAKE_CASE values
- Explicit relation names for disambiguation
- No cascade deletes by default
- Tenant-scoped models must index `businessId`

## Tenant Isolation Decisions

- All tenant data queried by `businessId`
- BusinessMembership is the gate for tenant access
- Public endpoints never trust client-provided `businessId`
- Service layer verifies active membership before tenant data access
- Cross-tenant reads are security bugs

## Audit Decisions

- AuditEvent is append-only (no updates, no deletes)
- Every audit event includes actorType, action, result, createdAt
- Tenant-scoped events include businessId
- actorUserId nullable for SYSTEM and AI_RECEPTIONIST actors
- Metadata field for flexible additional context

## Explicit Non-Implementation Confirmation

- No Prisma schema changes
- No migrations
- No generated client changes committed
- No product features
- No auth implementation
- No API routes
- No UI
- No provider SDKs
- No Supabase
- No contracts
- No domain renames

## Checks Run

- pnpm install — success
- pnpm prisma:generate — success
- pnpm prisma:format — success
- pnpm typecheck — success, 0 errors
- pnpm lint — success, 0 errors
- pnpm test — success, 18/18 tests passed
- pnpm build — success

## Issues Found

No blocking issues found.

## Decision

Accepted tenant and identity Prisma schema design

## Recommended Next Task

[Phase 1] TASK-0006: Implement tenant and identity Prisma schema
