# TASK-0011: Add Repository Integration Tests with Local Postgres

## Summary

Adds gated local PostgreSQL integration tests for the identity, tenancy, and audit repositories. Tests validate that Prisma schema, migration, generated client, and repository mapping logic work together against a real database.

## Files Created

- `__tests__/integration/tenant-identity-repositories.integration.test.ts`
- `docs/checkpoints/TASK-0011-repository-integration-tests-postgres.md`

## Files Modified

None.

## Integration Test Strategy

- Integration tests are gated by `RUN_INTEGRATION_TESTS=true`
- Normal `pnpm test` skips integration tests cleanly (1 file skipped)
- When enabled, connects to local PostgreSQL via `PrismaPg` adapter (same as project's `src/lib/prisma.ts`)
- Passes PrismaClient through type-safe adapters to repository factories
- Tests real DB flows: create → read → find → list → revoke/remove
- Cross-repository E2E flow validates full tenant/identity/audit lifecycle

## Database Setup

- Uses local PostgreSQL at `localhost:5432`
- Database: `ai_reception_saas`
- Migration applied via `pnpm prisma migrate reset --force`
- Migration: `20260509163715_add_tenant_identity_foundation`

## Repository Coverage

### Identity Repository (2 tests)
- Create and read user (create, findById, findByEmail, field mapping, ISO timestamps)
- Create, list, find, and revoke session (create, findById, findByTokenHash, listUserSessions, revokeSession)

### Tenancy Repository (3 tests)
- Create and read business (create, findById, findBySlug, listUserBusinesses with membership)
- Create membership and resolve tenant context (createMembership, findMembership, findMembershipById, resolveTenantContext)
- Remove membership sets REMOVED and denies tenant context (removeMembership, resolveTenantContext denial)

### Audit Repository (1 test)
- Create, find, and list audit events (createAuditEvent, findAuditEventById, listAuditEvents, metadata preservation)

### Cross-Repository Flow (1 test)
- Full tenant identity audit flow: user → business → membership → tenant context → session → audit event

## Skip Behavior

- `describeIntegration = integrationEnabled ? describe : describe.skip`
- When `RUN_INTEGRATION_TESTS` is not `true`: 1 test file skipped, 7 tests skipped
- Normal CI runs see: 8 passed, 1 skipped (test files), 168 passed, 7 skipped (tests)

## Cleanup Strategy

- `afterEach` runs `cleanDatabase(prisma)` to delete all records
- `afterAll` runs cleanup + `prisma.$disconnect()`
- Deletion order: `auditEvent` → `session` → `businessMembership` → `business` → `user` (dependency-safe)
- Local-only guard: throws if `DATABASE_URL` doesn't include `localhost` or `127.0.0.1`

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ Pass |
| `pnpm prisma:format` | ✅ Pass |
| `pnpm prisma:generate` | ✅ Pass |
| `pnpm typecheck` | ✅ Pass |
| `pnpm lint` | ✅ Pass (0 errors, 0 warnings) |
| `pnpm test` | ✅ Pass (8 files passed, 1 skipped; 168 tests passed, 7 skipped) |
| `pnpm build` | ✅ Pass |

## Integration Checks Run

| Check | Result |
|---|---|
| `docker start ai-reception-saas-postgres` | ✅ Container started |
| `pnpm prisma migrate reset --force` | ✅ Migration applied |
| Integration tests (RUN_INTEGRATION_TESTS=true) | ✅ 9 files passed, 175 tests passed |

## Issues Found

None.

## Scope Confirmation

- ✅ Integration tests gated by `RUN_INTEGRATION_TESTS=true`
- ✅ Normal test suite does not require live DB
- ✅ Integration tests use local PostgreSQL only
- ✅ Destructive cleanup guarded against non-local DATABASE_URL
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No new Prisma models
- ✅ No API routes
- ✅ No UI
- ✅ No auth runtime
- ✅ No provider SDKs
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames

## Decision

Accepted repository integration test baseline

## Recommended Next Task

[Phase 1] TASK-0012: Implement tenant and identity API contract design
