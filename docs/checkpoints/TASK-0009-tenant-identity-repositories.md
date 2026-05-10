# TASK-0009: Implement Tenant and Identity Repositories

## Summary

Prisma-backed repository boundaries for identity, tenancy, and audit persistence using injected Prisma-compatible clients. All repositories use dependency-injected DB delegates, map Prisma records to domain identities, and return `ActionResult<T>`. Tests use mocked delegates with zero database connectivity.

## Files Created

- `src/domains/identity/repository.ts`
- `src/domains/tenancy/repository.ts`
- `src/domains/audit/repository.ts`
- `__tests__/domains/tenant-identity-repositories.test.ts`
- `docs/checkpoints/TASK-0009-tenant-identity-repositories.md`

## Files Modified

- `src/domains/identity/index.ts` — added `export * from './repository'`
- `src/domains/tenancy/index.ts` — added `export * from './repository'`
- `src/domains/audit/index.ts` — added `export * from './repository'`

## Identity Repository

- **Factory**: `createIdentityRepository(db: IdentityRepositoryDb): IdentityRepository`
- **Record types**: `UserRecord`, `SessionRecord`
- **Mappers**: `mapUserRecord`, `mapSessionRecord`
- **Methods**: `createUser`, `updateUser`, `updateUserStatus`, `findUserById`, `findUserByEmail`, `createSession`, `findSessionById`, `findSessionByTokenHash`, `listUserSessions`, `revokeSession`
- **Date handling**: All Date fields converted to ISO strings via `.toISOString()`
- **Session creation**: `expiresAt` string converted to `new Date()`
- **Session revocation**: `revokedAt` string converted to `new Date()`, defaults to `new Date()`
- **List filtering**: `listUserSessions` excludes revoked sessions by default (`revokedAt: null`)
- **Error handling**: Catches unknown errors, returns `err('IDENTITY_REPOSITORY_ERROR', ...)`

## Tenancy Repository

- **Factory**: `createTenancyRepository(db: TenancyRepositoryDb): TenancyRepository`
- **Record types**: `BusinessRecord`, `BusinessMembershipRecord`
- **Mappers**: `mapBusinessRecord`, `mapBusinessMembershipRecord`
- **Methods**: `createBusiness`, `updateBusiness`, `findBusinessById`, `findBusinessBySlug`, `listUserBusinesses`, `createMembership`, `findMembership`, `findMembershipById`, `listBusinessMemberships`, `updateMembershipRole`, `updateMembershipStatus`, `removeMembership`, `resolveTenantContext`
- **Compound unique**: `findMembership` uses `userId_businessId` compound selector
- **List filtering**: `listBusinessMemberships` excludes `REMOVED` status by default
- **List filtering**: `listUserBusinesses` filters by `ACTIVE` membership status by default
- **Tenant resolution**: `resolveTenantContext` finds ACTIVE membership, returns `TENANT_ACCESS_DENIED` if missing
- **Error handling**: Catches unknown errors, returns `err('TENANCY_REPOSITORY_ERROR', ...)`

## Audit Repository

- **Factory**: `createAuditRepository(db: AuditRepositoryDb): AuditRepository`
- **Record types**: `AuditEventRecord`
- **Mappers**: `mapAuditEventRecord`
- **Methods**: `createAuditEvent`, `findAuditEventById`, `listAuditEvents`
- **Limit handling**: Default limit 50, max limit 100
- **Metadata**: Maps `JsonValue | null` directly
- **Error handling**: Catches unknown errors, returns `err('AUDIT_REPOSITORY_ERROR', ...)`

## Mapping Rules

- All `Date` fields → `string` via `.toISOString()`
- Nullable `Date | null` → `string | null`
- `metadata: Json? → JsonValue | null`
- No raw Prisma records exposed outside repository modules

## Tests Added

- `__tests__/domains/tenant-identity-repositories.test.ts` — 30 tests
  - Identity: factory exists, Date mapping, null returns, expiresAt conversion, revoked exclusion, revokedAt Date, error catching
  - Tenancy: factory exists, Date mapping, null returns, compound selector, REMOVED exclusion, tenant context resolution, access denied, error catching
  - Audit: factory exists, Date/metadata mapping, default limit 50, limit cap 100, null returns, error catching
  - Domain exports: 3 index export verification tests

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Pass |
| `pnpm prisma:format` | ✅ Pass |
| `pnpm prisma:generate` | ✅ Pass |
| `pnpm typecheck` | ✅ Pass |
| `pnpm lint` | ✅ Pass (0 errors, 0 warnings) |
| `pnpm test` | ✅ Pass (7 files, 135 tests) |
| `pnpm build` | ✅ Pass |

## Issues Found

None.

## Scope Confirmation

- ✅ Database queries exist only inside repository modules
- ✅ Repositories use injected Prisma-compatible client
- ✅ No PrismaClient instantiation
- ✅ No getPrisma usage
- ✅ No live database required in tests
- ✅ No service orchestration
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

Accepted tenant and identity repositories

## Recommended Next Task

[Phase 1] TASK-0010: Implement tenant and identity services
