# TASK-0007: Implement Tenant and Identity Domain Types and Validation

## Summary

Implemented domain-level TypeScript types, constants, permission definitions, and Zod validation schemas for the identity, tenancy, authz, and audit foundations. All validation is pure domain logic with no database access or PrismaClient usage.

## Files Created

- src/domains/identity/types.ts
- src/domains/identity/validation.ts
- src/domains/identity/index.ts
- src/domains/tenancy/types.ts
- src/domains/tenancy/validation.ts
- src/domains/tenancy/index.ts
- src/domains/authz/types.ts
- src/domains/authz/permissions.ts
- src/domains/authz/validation.ts
- src/domains/authz/index.ts
- src/domains/audit/types.ts
- src/domains/audit/validation.ts
- src/domains/audit/index.ts
- __tests__/domains/tenant-identity-validation.test.ts
- docs/checkpoints/TASK-0007-tenant-identity-domain-types-validation.md

## Files Modified

None.

## Identity Domain

- UserStatusValue type with ACTIVE, SUSPENDED, DEACTIVATED
- UserIdentity and SessionIdentity interfaces
- CreateUserInput, UpdateUserInput, CreateSessionInput, RevokeSessionInput
- Zod schemas: createUserInputSchema, updateUserInputSchema, createSessionInputSchema, revokeSessionInputSchema
- Email lowercasing/trimming, locale default en, token hash min 32 max 512

## Tenancy Domain

- BusinessStatusValue, MembershipStatusValue, MembershipRoleValue types
- BusinessIdentity, BusinessMembershipIdentity, TenantContext interfaces
- CreateBusinessInput, UpdateBusinessInput, CreateMembershipInput, UpdateMembershipRoleInput, UpdateMembershipStatusInput, ResolveTenantContextInput
- Zod schemas with slug regex validation, timezone default Asia/Tehran, locale default fa
- updateBusinessInputSchema requires at least one field beyond businessId

## Authz Domain

- 21 permissions defined in AUTHZ_PERMISSION_VALUES
- ROLE_PERMISSIONS map: OWNER (all), ADMIN (all except business.delete), OPERATOR (customer/conversation/message/AI operations), VIEWER (read-only)
- SENSITIVE_PERMISSIONS list
- hasPermission, isSensitivePermission, isKnownPermission, evaluateAccess functions
- evaluateAccess returns { allowed: false, reason: 'ROLE_NOT_PERMITTED' } for denied access
- accessCheckInputSchema Zod schema

## Audit Domain

- AuditActorTypeValue, AuditResultValue types
- AuditEventIdentity, CreateAuditEventInput interfaces
- Zod schema with actorType/actorUserId refine (USER requires actorUserId)
- Action format regex: /^[a-z][a-z0-9_.:-]*$/
- Uses JsonValue from src/lib/types for metadata

## Validation Rules

- UUID: z.string().uuid()
- ISO timestamp: z.string().datetime()
- Locale: enum en/fa
- Business slug: /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/, min 3 max 64
- Business name: trim, min 2 max 120
- User name: trim, min 1 max 120
- Email: trim, email, lowercased, max 320
- Token hash: string, min 32 max 512
- Audit action: /^[a-z][a-z0-9_.:-]*$/, min 3 max 120

## Tests Added

37 tests in __tests__/domains/tenant-identity-validation.test.ts:
- Identity: email lowercasing, locale defaults, invalid email rejection, empty update rejection, session validation, token hash validation
- Tenancy: slug lowercasing, defaults, invalid slug rejection, empty update rejection, membership defaults, tenant context validation
- Authz: OWNER all permissions, ADMIN no business.delete, OPERATOR conversations.reply, VIEWER messages.read, VIEWER no messages.create, sensitive permission checks, evaluateAccess behavior
- Audit: USER actor requires actorUserId, SYSTEM actor without actorUserId, invalid action format rejection
- Exports: all 4 domain index imports work

## Checks Run

- pnpm install — success
- pnpm prisma:format — success
- pnpm prisma:generate — success
- pnpm typecheck — success, 0 errors
- pnpm lint — success, 0 errors
- pnpm test — success, 88/88 passed (37 new + 51 existing)
- pnpm build — success

## Issues Found

None.

## Decision

Accepted tenant and identity domain types and validation

## Recommended Next Task

[Phase 1] TASK-0008: Implement tenant and identity service interfaces

Confirmed:
- No database queries
- No PrismaClient usage
- No auth runtime
- No API routes
- No UI
- No provider SDKs
- No Prisma schema changes
- No migrations
- No Supabase
- No contracts
- No domain renames
