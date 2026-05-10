# TASK-0010: Implement Tenant and Identity Services

## Summary

Concrete domain service implementations for identity, tenancy, authz, and audit. Services validate inputs with Zod, delegate to injected repositories (or pure permission helpers for authz), and return `ActionResult<T>`. No direct Prisma access, no auth runtime, no API routes.

## Files Created

- `src/domains/identity/implementation.ts`
- `src/domains/tenancy/implementation.ts`
- `src/domains/authz/implementation.ts`
- `src/domains/audit/implementation.ts`
- `__tests__/domains/tenant-identity-services.test.ts`
- `docs/checkpoints/TASK-0010-tenant-identity-services.md`

## Files Modified

- `src/domains/identity/index.ts` — added `export * from './implementation'`
- `src/domains/tenancy/index.ts` — added `export * from './implementation'`
- `src/domains/authz/index.ts` — added `export * from './implementation'`
- `src/domains/audit/index.ts` — added `export * from './implementation'`

## Identity Service Implementation

- **Factory**: `createIdentityService(deps: IdentityServiceDeps): IdentityService`
- **Dependency**: `IdentityRepository`
- **Validation**: All inputs validated with Zod before repository calls
- **Email normalization**: trimmed + lowercased via `emailSchema`
- **Methods**: `createUser`, `updateUser`, `updateUserStatus`, `findUserById`, `findUserByEmail`, `createSession`, `findSessionById`, `findSessionByTokenHash`, `listUserSessions`, `revokeSession`
- **Error code**: `INVALID_IDENTITY_INPUT` for all validation failures

## Tenancy Service Implementation

- **Factory**: `createTenancyService(deps: TenancyServiceDeps): TenancyService`
- **Dependency**: `TenancyRepository`
- **Slug normalization**: trimmed + lowercased via `businessSlugSchema`
- **Defaults**: `createBusiness` defaults timezone `Asia/Tehran`, locale `fa`; `createMembership` defaults role `VIEWER`, status `INVITED`
- **Methods**: `createBusiness`, `updateBusiness`, `findBusinessById`, `findBusinessBySlug`, `listUserBusinesses`, `createMembership`, `findMembership`, `findMembershipById`, `listBusinessMemberships`, `updateMembershipRole`, `updateMembershipStatus`, `removeMembership`, `resolveTenantContext`
- **Error code**: `INVALID_TENANCY_INPUT` for validation failures; `TENANT_ACCESS_DENIED` passed through from repository

## Authz Service Implementation

- **Factory**: `createAuthzService(): AuthzService` (no dependencies — stateless)
- **Logic**: Uses pure `evaluateAccess`, `isSensitivePermission`, `ROLE_PERMISSIONS` from permissions module
- **Methods**: `evaluateAccess`, `requirePermission`, `listRolePermissions`, `isSensitivePermission`
- **Error codes**: `INVALID_AUTHZ_INPUT`, `ACCESS_DENIED`, `UNKNOWN_PERMISSION`

## Audit Service Implementation

- **Factory**: `createAuditService(deps: AuditServiceDeps): AuditService`
- **Dependency**: `AuditRepository`
- **Validation**: Validates all fields including action regex, limit range (1-100), UUID fields
- **USER actor rule**: Enforced via `createAuditEventInputSchema` refine — requires `actorUserId` when `actorType` is `USER`
- **Methods**: `createAuditEvent`, `findAuditEventById`, `listAuditEvents`
- **Error code**: `INVALID_AUDIT_INPUT` for validation failures

## Validation Behavior

- All inputs validated with Zod `safeParse` before any repository call
- Invalid inputs return `err()` with domain-specific error code
- Repository `ActionResult` failures passed through without wrapping
- Email normalized (trim + lowercase) before user lookup/creation
- Slug normalized (trim + lowercase) before business lookup/creation
- Business defaults: timezone `Asia/Tehran`, locale `fa`
- Membership defaults: role `VIEWER`, status `INVITED`
- Audit limit: max 100, validated at service layer

## Tests Added

- `__tests__/domains/tenant-identity-services.test.ts` — 33 tests
  - Identity (7): factory exists, email normalization, invalid email rejection, empty update rejection, email lowercasing, short tokenHash rejection, repository error passthrough
  - Tenancy (8): factory exists, slug lowercase, timezone/locale defaults, invalid slug rejection, empty update rejection, slug lowercase on lookup, membership defaults, tenant access denied passthrough
  - Authz (7): factory exists, OWNER business.delete allowed, VIEWER messages.create denied, OPERATOR permissions, sensitive permission check, unknown permission rejection, invalid role rejection
  - Audit (7): factory exists, USER actor with userId, USER actor without userId rejection, invalid action rejection, limit max validation, invalid UUID rejection, repository error passthrough
  - Exports (4): index export verification for all 4 domains

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Pass |
| `pnpm prisma:format` | ✅ Pass |
| `pnpm prisma:generate` | ✅ Pass |
| `pnpm typecheck` | ✅ Pass |
| `pnpm lint` | ✅ Pass (0 errors, 0 warnings) |
| `pnpm test` | ✅ Pass (8 files, 168 tests) |
| `pnpm build` | ✅ Pass |

## Issues Found

- `createAuditEventInputSchema` uses `z.unknown()` for metadata, producing `unknown` type output. Required `as CreateAuditEventInput` assertion when passing to repository since domain type expects `JsonValue`. Runtime behavior is correct.

## Scope Confirmation

- ✅ Service orchestration implemented
- ✅ Repositories are injected
- ✅ No direct Prisma delegate calls in service files
- ✅ No PrismaClient instantiation
- ✅ No getPrisma usage
- ✅ No live database required in tests
- ✅ No auth runtime
- ✅ No API routes
- ✅ No UI
- ✅ No provider SDKs
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No new Prisma models
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames

## Decision

Accepted tenant and identity service implementations

## Recommended Next Task

[Phase 1] TASK-0011: Add repository integration tests with local Postgres
