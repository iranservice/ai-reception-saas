# Auth Provider Persistence Migration Proposal

## Status

Accepted migration proposal; implementation deferred.

## Date

2026-05-14

## Baseline

- **Main commit:** `545aa0b22b69c2d9d699aaa7d76828d6479e01e1`
- **Prior strategy ADR:** `docs/architecture/runtime-authentication-strategy.md`
- **Prior compatibility review:** `docs/architecture/authjs-compatibility-review.md`
- **Prior schema design:** `docs/architecture/authjs-schema-design.md`
- **Prior spike report:** `docs/architecture/authjs-prisma-adapter-spike-report.md`
- **Current task:** TASK-0030
- **Decision scope:** Documentation/proposal only

## Context

- The project selected provider-abstracted runtime auth with Auth.js as the preferred first implementation candidate.
- TASK-0029 validated the adapter naming risk.
- Prefixed provider persistence model names (`AuthAccount`, `AuthSession`, `AuthVerificationToken`) do not work directly with the default `PrismaAdapter`.
- Exact `Account` and `VerificationToken` model names are recommended because they do not conflict with any current internal models.
- Auth.js database `Session` is intentionally not proposed for the first migration because the project already owns an internal `Session` model with different semantics.
- JWT session strategy is recommended initially to avoid the `Session` naming conflict.
- Internal tenant and authz ownership remains unchanged.

## Current Internal Schema Summary

### User

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` | UUID primary key |
| `email` | `String @unique` | Required and unique |
| `name` | `String` | Required |
| `locale` | `String @default("en")` | User locale preference |
| `status` | `UserStatus @default(ACTIVE)` | ACTIVE/SUSPENDED/DEACTIVATED |
| `avatarUrl` | `String? @map("avatar_url")` | Internal image/avatar field |
| `createdAt` | `DateTime @default(now()) @map("created_at")` | Creation timestamp |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` | Update timestamp |

- `email` is required and unique.
- `name` is required.
- `emailVerified` is missing — must be added.
- `avatarUrl` is the internal image/avatar field.
- User is the canonical application user.

### Internal Session

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` | UUID primary key |
| `userId` | `String @map("user_id") @db.Uuid` | FK to User |
| `tokenHash` | `String @unique @map("token_hash")` | Hashed session token |
| `expiresAt` | `DateTime @map("expires_at")` | Expiration timestamp |
| `revokedAt` | `DateTime? @map("revoked_at")` | Revocation timestamp |
| `ipAddress` | `String? @map("ip_address")` | Client IP |
| `userAgent` | `String? @map("user_agent")` | Client user agent |
| `createdAt` | `DateTime @default(now()) @map("created_at")` | Creation timestamp |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` | Update timestamp |

- Internal hashed-token session model.
- Must remain unchanged.
- Must not be used as Auth.js database Session in first migration.

### Tenant/Authz Models

- `Business` remains tenant root.
- `BusinessMembership` remains membership/role source.
- `Authz` remains internal.
- Auth provider persistence must not own tenant authorization.

## TASK-0029 Spike Findings Applied

| Finding | Proposal Impact |
|---|---|
| Prefixed `Auth*` model names do not work directly with default `PrismaAdapter` | Use exact `Account` and `VerificationToken` names |
| Default adapter expects `prisma.session` | Do not add Auth.js Session initially; use JWT strategy |
| Internal Session already exists | Keep internal Session unchanged |
| UUID primary keys compiled | Use UUID primary keys |
| Required `User.name`/`email` compile but runtime fallbacks may be needed | Keep fields unchanged for migration proposal; runtime adapter must handle fallbacks |
| `avatarUrl` vs `image` needs mapping | Keep `avatarUrl` internal; runtime adapter maps provider image to `avatarUrl` |
| Prisma 7 compile-level compatible | Future implementation must still verify DB runtime behavior |

## Proposed Migration Summary

This future migration should:

1. Add nullable `User.emailVerified`.
2. Add exact Auth.js-compatible `Account` model.
3. Add exact Auth.js-compatible `VerificationToken` model.
4. Add `User.accounts Account[]` relation.
5. Not add Auth.js database `Session` initially.
6. Keep internal `Session` unchanged.
7. Keep `Business`, `BusinessMembership`, `AuditEvent`, and `Authz` unchanged.
8. Use JWT session strategy initially.

## Proposed User Change

> **Note:** This snippet is a proposal only. It must not be applied in this task.

```prisma
model User {
  // existing fields unchanged
  id            String     @id @default(uuid()) @db.Uuid
  email         String     @unique
  name          String
  locale        String     @default("en")
  status        UserStatus @default(ACTIVE)
  avatarUrl     String?    @map("avatar_url")
  emailVerified DateTime?  @map("email_verified")  // NEW
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  // existing relations unchanged
  sessions           Session[]
  memberships        BusinessMembership[]
  createdBusinesses  Business[]           @relation("BusinessCreator")
  invitedMemberships BusinessMembership[] @relation("MembershipInviter")
  auditEvents        AuditEvent[]         @relation("AuditActor")

  // NEW relation
  accounts Account[]

  @@map("users")
}
```

**Changes from current schema:**
- Added `emailVerified DateTime? @map("email_verified")` — nullable, no data loss for existing rows.
- Added `accounts Account[]` — relation to new Account model.
- All existing fields and relations preserved exactly.

**Not changed:**
- `name` remains required. Runtime adapter must provide fallback if OAuth provider omits name.
- `email` remains required. Runtime adapter must provide fallback if OAuth provider omits email.
- `avatarUrl` remains the canonical field. Runtime adapter maps provider `image` to `avatarUrl`.

## Proposed Account Model

> **Note:** This snippet is a proposal only. It must not be applied in this task.

```prisma
model Account {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @map("user_id") @db.Uuid
  type              String
  provider          String
  providerAccountId String   @map("provider_account_id")
  refreshToken      String?  @map("refresh_token") @db.Text
  accessToken       String?  @map("access_token") @db.Text
  expiresAt         Int?     @map("expires_at")
  tokenType         String?  @map("token_type")
  scope             String?
  idToken           String?  @map("id_token") @db.Text
  sessionState      String?  @map("session_state")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@map("accounts")
}
```

**Design decisions:**
- Uses exact Auth.js model name `Account` so `PrismaAdapter` can access `prisma.account` directly.
- Uses UUID `@db.Uuid` for `id` and `userId` to match internal convention.
- Uses `onDelete: Cascade` — deleting a User removes associated provider accounts.
- Adds `createdAt`/`updatedAt` for auditability (Auth.js default schema omits these; adding them is safe).
- Uses snake_case column mapping via `@map` to match project convention.
- Table mapped to `accounts` via `@@map("accounts")`.

**Purpose:** Links external identity provider accounts (Google, GitHub, email/credentials, etc.) to an internal User. Supports multiple providers per user for account linking.

## Proposed VerificationToken Model

> **Note:** This snippet is a proposal only. It must not be applied in this task.

```prisma
model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

**Design decisions:**
- Uses exact Auth.js model name `VerificationToken` so `PrismaAdapter` can access `prisma.verificationToken` directly.
- No `id` field — Auth.js uses `@@unique([identifier, token])` as the composite key.
- No `userId` relation — tokens are identified by email identifier, not user FK.
- No `createdAt`/`updatedAt` — tokens are short-lived and deleted after use.
- Matches Auth.js adapter expectations exactly.
- Table mapped to `verification_tokens` via `@@map("verification_tokens")`.

**Purpose:** Stores email/magic-link verification tokens used by Auth.js for email-based authentication flows.

## Models Intentionally NOT Proposed

### Auth.js Database Session

Not proposed in this migration because:
- Auth.js default adapter expects model name `Session`.
- The project already has an internal `Session` model with different semantics (hashed token, revocation, IP/UA tracking).
- Adding a second `Session` model would conflict.
- JWT session strategy (`strategy: "jwt"`) avoids the need for a database session model entirely.

**Future consideration:** If database sessions are needed later, options include:
1. Create a custom adapter wrapper that maps delegate names.
2. Rename internal `Session` to `InternalSession` (breaking change to existing code/tests).
3. Implement a hybrid approach with a separate `AuthSession` table and custom adapter.

### Authenticator (WebAuthn/Passkeys)

Not proposed because WebAuthn/passkey support is not yet planned. Can be added in a future migration if needed.

## Session Strategy

| Strategy | Proposed? | Rationale |
|---|---|---|
| JWT (`strategy: "jwt"`) | ✅ Yes — initial | Avoids Session naming conflict; stateless; no DB lookup per request |
| Database (`strategy: "database"`) | ⏸️ Deferred | Requires Session model that conflicts with internal Session |

**JWT session trade-offs:**
- ✅ No database Session table needed
- ✅ No DB lookup per request
- ✅ Avoids internal Session naming conflict
- ⚠️ Harder to revoke individual sessions immediately
- ⚠️ Token size limits for large payloads
- ⚠️ Session data is client-visible (encrypted but not server-side only)

**Mitigation for revocation:** Implement a server-side token blocklist or use short JWT expiration with refresh tokens if immediate revocation is required.

## Complete Proposed Schema Diff Summary

| Change | Type | Details |
|---|---|---|
| `User.emailVerified` | Add field | `DateTime? @map("email_verified")` — nullable, safe for existing data |
| `User.accounts` | Add relation | `Account[]` — Auth.js provider account linking |
| `Account` | New model | 14 fields + unique constraint + index, mapped to `accounts` |
| `VerificationToken` | New model | 3 fields + unique constraint, mapped to `verification_tokens` |
| `Session` (internal) | Unchanged | All fields preserved |
| `Business` | Unchanged | All fields preserved |
| `BusinessMembership` | Unchanged | All fields preserved |
| `AuditEvent` | Unchanged | All fields preserved |

## Migration Order

### Step 1 — Single additive migration

All changes are additive and can be applied in a single migration:

1. `ALTER TABLE users ADD COLUMN email_verified TIMESTAMP` — nullable, no data loss.
2. `CREATE TABLE accounts (...)` — new table with FK to users.
3. `CREATE TABLE verification_tokens (...)` — new table, no FK.
4. Create indexes on `accounts(user_id)` and `accounts(provider, provider_account_id)`.
5. Create unique index on `verification_tokens(identifier, token)`.

### Step 2 — Deferred (future tasks only)

- Auth.js database Session table (if JWT strategy is replaced).
- Authenticator table (if WebAuthn/passkeys are adopted).
- Optional: make `User.name` nullable if Auth.js adapter requires it.
- Optional: add `User.image` field if adapter mapping cannot handle `avatarUrl`.

## Migration File Naming

Follow existing project convention:

```
prisma/migrations/NNNN_auth_provider_persistence/migration.sql
```

Where `NNNN` is the next sequential migration number after current migrations.

## Index Strategy

| Table | Index | Type | Purpose |
|---|---|---|---|
| `accounts` | `(user_id)` | Regular | FK lookup for user's provider accounts |
| `accounts` | `(provider, provider_account_id)` | Unique | Provider account uniqueness |
| `verification_tokens` | `(identifier, token)` | Unique | Token lookup by email + token |

## Foreign Key Strategy

| Relation | On Delete | Rationale |
|---|---|---|
| `Account.userId → User.id` | `Cascade` | Deleting a user removes all linked provider accounts |

**Note:** `Cascade` is the Auth.js default and matches expected adapter behavior. User deletion is destructive — consider soft-delete patterns if user recovery is needed.

## Rollback Plan

### If migration fails or is rejected

1. Drop `verification_tokens` table.
2. Drop `accounts` table.
3. Remove `email_verified` column from `users` table.

All rollback steps are safe because:
- New tables contain no production data at migration time.
- `email_verified` is nullable, so removal has no data loss.
- No existing columns or tables are modified.
- No existing indexes are changed.

## Adapter Compatibility Notes

### Model name alignment

| Auth.js Adapter Expects | Proposed Model Name | Compatible? |
|---|---|---|
| `prisma.user` | `User` (existing) | ✅ Yes |
| `prisma.account` | `Account` (new) | ✅ Yes |
| `prisma.verificationToken` | `VerificationToken` (new) | ✅ Yes |
| `prisma.session` | Not proposed (JWT strategy) | ✅ N/A — JWT strategy does not use adapter Session |

### Remaining validation for implementation task

- Verify `PrismaAdapter(prisma)` compiles with the final schema (Account + VerificationToken + JWT).
- Verify runtime DB operations work with Prisma 7 + `@prisma/adapter-pg`.
- Verify `createUser` handles required `name`/`email` fields gracefully.
- Verify provider `image` maps correctly to `avatarUrl` through adapter layer.

## Security Considerations

- `Account.accessToken` and `Account.refreshToken` store OAuth provider tokens. These are sensitive and should be encrypted at rest in production.
- `VerificationToken.token` is a short-lived email verification token. Expired tokens should be cleaned up periodically.
- `User.status` must be checked after authentication — suspended/deactivated users must not receive active context.
- Production must **not** enable `ENABLE_DEV_AUTH_CONTEXT`.
- JWT `AUTH_SECRET` must be a strong random secret with sufficient entropy.

## Tenant Context Interaction

- Auth.js schema changes do **not** affect `Business`, `BusinessMembership`, or `AuditEvent`.
- Tenant context resolution continues to flow from `BusinessMembership` after user authentication.
- Auth.js resolves "who is the user?" → internal resolver maps to `BusinessMembership` → tenant context is produced.
- No tenant-related schema changes in this proposal.

## Audit Interaction

- Auth events (login, logout, account link, verification) should eventually produce `AuditEvent` records.
- No new audit-specific schema changes are proposed.
- Future implementation should use existing `AuditEvent` with new action names (e.g., `auth.login`, `auth.logout`, `auth.link_account`).

## Recommended Future Task Breakdown

| Task | Description | Depends On |
|---|---|---|
| TASK-0031 | Apply auth provider persistence migration (`Account`, `VerificationToken`, `emailVerified`) | TASK-0030 |
| TASK-0032 | Install Auth.js packages and create provider spike config | TASK-0031 |
| TASK-0033 | Runtime auth adapter interface implementation (JWT strategy) | TASK-0032 |
| TASK-0034 | Internal User mapping and account linking tests | TASK-0033 |
| TASK-0035 | Tenant context production resolver design | TASK-0034 |
| TASK-0036 | Auth security hardening checklist | TASK-0035 |
| TASK-0037 | Auth runtime implementation behind feature flag | TASK-0036 |

## Explicit Non-Goals

- No Prisma schema changes
- No migration files created
- No Auth.js installation
- No `@auth/prisma-adapter` installation
- No `next-auth` installation
- No provider SDK installation
- No route changes
- No handler changes
- No middleware
- No login/signup UI
- No callback routes
- No test changes
- No package changes
- No lockfile changes
- No env changes
- No workflow changes

## Consequences

### Positive

- Actionable migration proposal ready for implementation.
- Uses exact Auth.js model names validated by TASK-0029 spike.
- Migration is fully additive and reversible.
- JWT session strategy avoids internal Session conflict.
- Internal tenant/authz model is untouched.
- Single migration step covers all changes.

### Negative

- JWT sessions are harder to revoke than database sessions.
- Auth.js v5 is still in beta.
- Runtime DB compatibility with Prisma 7 is not yet verified beyond compile-level.
- `User.name` and `User.email` being required may need runtime fallback handling.

## Decision

Accepted migration proposal: add `emailVerified` to User, create `Account` and `VerificationToken` models using exact Auth.js names, adopt JWT session strategy, preserve internal Session and all tenant/authz models unchanged.

## Recommended Next Task

[Phase 2] TASK-0031: Apply auth provider persistence migration (Account, VerificationToken, emailVerified)
