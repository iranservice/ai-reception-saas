# TASK-0008: Implement Tenant and Identity Service Interfaces

## Summary

Pure TypeScript service interfaces for identity, tenancy, authz, and audit domain boundaries.
No implementation logic, no database access, no runtime side effects.

## Files Created

- `src/domains/identity/service.ts`
- `src/domains/tenancy/service.ts`
- `src/domains/authz/service.ts`
- `src/domains/audit/service.ts`
- `__tests__/domains/tenant-identity-service-interfaces.test.ts`
- `docs/checkpoints/TASK-0008-tenant-identity-service-interfaces.md`

## Files Modified

- `src/domains/identity/index.ts` — added `export * from './service'`
- `src/domains/tenancy/index.ts` — added `export * from './service'`
- `src/domains/authz/index.ts` — added `export * from './service'`
- `src/domains/audit/index.ts` — added `export * from './service'`

## Identity Service Interface

- **Interface**: `IdentityService`
- **Input types**: `FindUserByIdInput`, `FindUserByEmailInput`, `UpdateUserStatusInput`, `FindSessionByIdInput`, `FindSessionByTokenHashInput`, `ListUserSessionsInput`
- **Error codes**: `USER_NOT_FOUND`, `USER_EMAIL_ALREADY_EXISTS`, `SESSION_NOT_FOUND`, `SESSION_REVOKED`, `SESSION_EXPIRED`, `INVALID_IDENTITY_INPUT`
- **Methods**: `createUser`, `updateUser`, `updateUserStatus`, `findUserById`, `findUserByEmail`, `createSession`, `findSessionById`, `findSessionByTokenHash`, `listUserSessions`, `revokeSession`

## Tenancy Service Interface

- **Interface**: `TenancyService`
- **Input types**: `FindBusinessByIdInput`, `FindBusinessBySlugInput`, `ListUserBusinessesInput`, `FindMembershipInput`, `FindMembershipByIdInput`, `ListBusinessMembershipsInput`, `RemoveMembershipInput`
- **Error codes**: `BUSINESS_NOT_FOUND`, `BUSINESS_SLUG_ALREADY_EXISTS`, `MEMBERSHIP_NOT_FOUND`, `MEMBERSHIP_ALREADY_EXISTS`, `MEMBERSHIP_INACTIVE`, `LAST_OWNER_REMOVAL_DENIED`, `INVALID_TENANCY_INPUT`, `TENANT_ACCESS_DENIED`
- **Methods**: `createBusiness`, `updateBusiness`, `findBusinessById`, `findBusinessBySlug`, `listUserBusinesses`, `createMembership`, `findMembership`, `findMembershipById`, `listBusinessMemberships`, `updateMembershipRole`, `updateMembershipStatus`, `removeMembership`, `resolveTenantContext`

## Authz Service Interface

- **Interface**: `AuthzService`
- **Input types**: `ListRolePermissionsInput`, `RequirePermissionInput`
- **Error codes**: `ACCESS_DENIED`, `UNKNOWN_PERMISSION`, `INVALID_AUTHZ_INPUT`
- **Methods**: `evaluateAccess`, `requirePermission`, `listRolePermissions`, `isSensitivePermission`

## Audit Service Interface

- **Interface**: `AuditService`
- **Input types**: `FindAuditEventByIdInput`, `ListAuditEventsInput`
- **Error codes**: `AUDIT_EVENT_NOT_FOUND`, `INVALID_AUDIT_INPUT`, `AUDIT_WRITE_FAILED`
- **Methods**: `createAuditEvent`, `findAuditEventById`, `listAuditEvents`

## Tests Added

- `__tests__/domains/tenant-identity-service-interfaces.test.ts` — 16 tests
  - Compile-time type assertions for all four service interfaces
  - Compile-time `satisfies` shape checks for all service interfaces
  - Runtime error code constant assertions for all four domains
  - Dynamic import verification for domain barrel exports

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Pass |
| `pnpm prisma:format` | ✅ Pass |
| `pnpm prisma:generate` | ✅ Pass |
| `pnpm typecheck` | ✅ Pass |
| `pnpm lint` | ✅ Pass |
| `pnpm test` | ✅ Pass (6 files, 105 tests) |
| `pnpm build` | ✅ Pass |

## Issues Found

None.

## Scope Confirmation

- ✅ No database queries
- ✅ No PrismaClient usage
- ✅ No getPrisma usage
- ✅ No service implementation logic
- ✅ No auth runtime
- ✅ No API routes
- ✅ No UI
- ✅ No provider SDKs
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames

## Decision

Accepted tenant and identity service interfaces

## Recommended Next Task

[Phase 1] TASK-0009: Implement tenant and identity repositories
