# TASK-0031: Auth Provider Persistence Schema and Migration

## Summary

Applied the accepted auth provider persistence schema migration. Added `User.emailVerified`, exact `Account` model, exact `VerificationToken` model, migration SQL file, and schema structure tests.

## Files Created

- `prisma/migrations/20260514_auth_provider_persistence/migration.sql`
- `docs/checkpoints/TASK-0031-auth-provider-persistence-schema-migration.md`

## Files Modified

- `prisma/schema.prisma` — added `emailVerified` to User, added `accounts` relation, added `Account` model, added `VerificationToken` model
- `__tests__/foundation/prisma-schema.test.ts` — added 21 new schema structure tests for auth provider persistence

## Schema Changes

### User Changes

- Added `emailVerified DateTime? @map("email_verified")` — nullable, no data loss for existing rows
- Added `accounts Account[]` — relation to new Account model
- All existing fields and relations preserved exactly
- `name` remains required
- `email` remains required
- `avatarUrl` remains canonical avatar field
- No `image` field added (per TASK-0030B adapter contract)

### New Models

#### Account

- Exact Auth.js model name (not `AuthAccount`) per TASK-0029 spike finding
- UUID primary key with `@db.Uuid`
- FK to User with `onDelete: Cascade`
- Unique constraint on `[provider, providerAccountId]`
- Index on `userId`
- Mapped to `accounts` table
- All Auth.js required fields: type, provider, providerAccountId, refreshToken, accessToken, expiresAt, tokenType, scope, idToken, sessionState
- Added `createdAt`/`updatedAt` for auditability

#### VerificationToken

- Exact Auth.js model name (not `AuthVerificationToken`) per TASK-0029 spike finding
- No `id` field — uses composite unique key `[identifier, token]`
- Mapped to `verification_tokens` table
- Fields: identifier, token, expires

### Unchanged Models

- `Session` — internal hashed-token session, unchanged (JWT strategy avoids Auth.js Session conflict)
- `Business` — unchanged
- `BusinessMembership` — unchanged
- `AuditEvent` — unchanged

## Migration File

`prisma/migrations/20260514_auth_provider_persistence/migration.sql`

Additive-only migration:
1. `ALTER TABLE users ADD COLUMN email_verified TIMESTAMP(3)`
2. `CREATE TABLE accounts (...)`
3. `CREATE TABLE verification_tokens (...)`
4. Create indexes and unique constraints
5. Add FK with CASCADE delete

## Tests Added

21 new tests in `prisma-schema.test.ts`:
- Account and VerificationToken model existence
- Account and VerificationToken table mappings
- Account and VerificationToken unique constraints
- User.emailVerified field presence and type
- User.accounts relation
- User.name remains required
- User.email remains required
- No `image` field on User
- Account UUID primary key
- Account onDelete Cascade
- Account userId index
- Account Auth.js required fields
- VerificationToken composite key (no @id)
- VerificationToken fields
- Exact naming (Account not AuthAccount)
- Exact naming (VerificationToken not AuthVerificationToken)
- No Auth.js database Session (JWT strategy)
- Internal Session unchanged

## Checks Run

| Check | Result |
|---|---|
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 3 warnings) |
| `pnpm test` | ✅ 561 passed, 7 skipped |
| `pnpm build` | ✅ |

## Issues Found

None.

## Decision

Schema migration applied per accepted TASK-0030 proposal and TASK-0030B adapter contract. Uses exact Auth.js model names, JWT session strategy, internal Session unchanged, tenant/authz models unchanged.

## Recommended Next Task

[Phase 2] TASK-0032: Install Auth.js packages and create provider spike config

## Scope Confirmation

- ✅ Schema changes applied (additive only)
- ✅ Migration file created
- ✅ Schema tests added
- ✅ Checkpoint document created
- ✅ No Auth.js installation
- ✅ No @auth/prisma-adapter installation
- ✅ No package.json changes
- ✅ No lockfile changes
- ✅ No runtime auth implementation
- ✅ No middleware
- ✅ No auth routes
- ✅ No provider secrets
- ✅ No UI
- ✅ No env changes
- ✅ No workflow changes
- ✅ Internal Session unchanged
- ✅ Tenant/authz ownership unchanged
