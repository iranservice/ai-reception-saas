# TASK-0006: Implement Tenant and Identity Prisma Schema

## Summary

Implemented the first Prisma schema foundation for users, sessions, businesses, memberships, and audit events. Added 6 enums and 5 models to prisma/schema.prisma. Created schema structure tests. Migration could not be created because DATABASE_URL is not configured locally.

## Files Created

- __tests__/foundation/prisma-schema.test.ts
- docs/checkpoints/TASK-0006-implement-tenant-identity-prisma-schema.md

## Files Modified

- prisma/schema.prisma

## Prisma Enums Implemented

- UserStatus (ACTIVE, SUSPENDED, DEACTIVATED)
- BusinessStatus (ACTIVE, SUSPENDED, ARCHIVED)
- MembershipStatus (INVITED, ACTIVE, DECLINED, EXPIRED, REMOVED, LEFT)
- MembershipRole (OWNER, ADMIN, OPERATOR, VIEWER)
- AuditActorType (USER, SYSTEM, AI_RECEPTIONIST)
- AuditResult (SUCCESS, DENIED, FAILED)

## Prisma Models Implemented

- User — global identity with email, name, locale, status, avatarUrl
- Session — app-owned session with tokenHash, expiresAt, revokedAt
- Business — tenant root with name, slug, status, timezone, locale
- BusinessMembership — user-business link with role, status, unique(userId, businessId)
- AuditEvent — append-only audit trail with actorType, action, result, metadata

## Deferred Models Confirmed

- Role — deferred (using MembershipRole enum for MVP)
- Permission — deferred (using hardcoded permission map for MVP)
- RolePermission — deferred (not needed until Role and Permission become tables)
- PolicyRule — deferred (ABAC and custom policy rules are future scope)
- Customer — not in scope
- Conversation — not in scope
- Message — not in scope
- Channel — not in scope
- AI Draft — not in scope
- Knowledge Source — not in scope
- Billing — not in scope
- Analytics — not in scope

## Migration

- Command: `pnpm prisma migrate dev --name add_tenant_identity_foundation`
- Result: Failed — DATABASE_URL is not configured
- Migration folder: Not created
- Error: `Error: Connection url is empty. See https://pris.ly/d/config-url`

Migration will be created when a local PostgreSQL database is available. The schema is valid (confirmed by `prisma format` and `prisma generate` succeeding).

## Tests Added

- __tests__/foundation/prisma-schema.test.ts
  - 6 enum existence and value tests
  - 5 required model existence tests
  - 4 deferred model non-existence tests
  - 6 out-of-scope model non-existence tests
  - 5 table mapping tests
  - 4 constraint tests (unique email, tokenHash, slug, userId+businessId)
  - 3 provider-specific field absence tests

## Checks Run

- pnpm install — success
- pnpm prisma:format — success
- pnpm prisma:generate — success
- pnpm typecheck — success, 0 errors
- pnpm lint — success, 0 errors
- pnpm test — success, all tests passed
- pnpm build — success
- pnpm prisma migrate dev — failed (DATABASE_URL not configured)

## Issues Found

- Migration cannot be created because DATABASE_URL is not configured locally
- This is expected — migration will be created when a local PostgreSQL database is provisioned

## Decision

Accepted tenant and identity Prisma schema implementation

## Recommended Next Task

[Phase 1] TASK-0007: Implement tenant and identity domain types and validation
