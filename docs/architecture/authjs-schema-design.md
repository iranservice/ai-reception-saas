# Auth.js Schema Design and Migration Proposal

## Status

Accepted schema design proposal; implementation deferred.

## Date

2026-05-14

## Baseline

- **Main commit:** `bbcb00e4519d72e0314bb0ce57000afa1e7d2290`
- **Prior ADR:** `docs/architecture/runtime-authentication-strategy.md`
- **Prior compatibility review:** `docs/architecture/authjs-compatibility-review.md`
- **Current task:** TASK-0028
- **Decision scope:** Documentation/design only

## Context

- TASK-0026 selected provider-abstracted runtime auth with Auth.js as preferred first implementation candidate.
- TASK-0027 reviewed compatibility and recommended reusing internal `User` while adding separate Auth.js-compatible provider persistence models.
- This task proposes exact schema direction, naming, migration order, and risks.
- No schema changes are made in this task.

## Current Schema Constraints

- `User` is the canonical application user.
- `User.email` is required and unique.
- `User.name` is required.
- `User.emailVerified` is missing.
- `User.avatarUrl` differs from Auth.js `image` naming.
- `Session` is an internal hashed-token session model and must not be reused blindly for Auth.js.
- `BusinessMembership`/`Authz` remain internal and provider-agnostic.
- Prisma 7 uses `prisma.config.ts` datasource URL pattern.

## Design Goals

- Preserve internal `User` as canonical application user
- Preserve existing internal `Session` semantics
- Avoid naming collision with existing `Session`
- Support Auth.js provider account linking
- Support database session strategy if chosen
- Support email verification / magic-link token if chosen
- Keep `BusinessMembership` and `Authz` untouched
- Keep provider data isolated from domain services
- Make migration reversible where possible
- Avoid package/runtime implementation in this task

## Proposed Naming Strategy

Recommended explicit prefixed model names:

| Prisma Model | Table Name | Purpose |
|---|---|---|
| `AuthAccount` | `auth_accounts` | Provider account linking (OAuth/credentials) |
| `AuthSession` | `auth_sessions` | Auth.js database session persistence |
| `AuthVerificationToken` | `auth_verification_tokens` | Email/magic-link verification tokens |
| `AuthAuthenticator` | `auth_authenticators` | WebAuthn/passkey credentials (deferred) |

**Rationale:**

- Avoids collision with existing internal `Session`.
- Makes provider-owned persistence visually distinct.
- Keeps internal `Session` untouched.
- Prisma model names map to snake_case tables via `@@map`.

**Adapter Compatibility Note:**
If the Auth.js Prisma Adapter requires exact model names (`Account`, `Session`, etc.), adapter mapping or a custom adapter wrapper may be needed. This task recommends prefixed names but flags adapter compatibility as a validation requirement for the implementation spike (TASK-0029).

## Proposed User Changes

### Add `emailVerified` field

```prisma
emailVerified DateTime? @map("email_verified")
```

This field is commonly expected by Auth.js for email/magic-link verification flows. Adding it to the existing `User` model preserves the single canonical user identity.

### `name` field — keep required

- Auth.js examples show `name String?` (optional).
- Current internal schema requires `name String`.
- **Recommendation:** Keep `name` required for now. Provide a fallback value (e.g., email prefix or "User") during Auth.js user creation if the provider does not supply a name.
- If the implementation spike reveals that the adapter cannot handle required `name`, reconsider in TASK-0029.

### `avatarUrl` field — keep as canonical

- Auth.js expects `image String?`.
- Current internal schema uses `avatarUrl String? @map("avatar_url")`.
- **Recommendation:** Keep `avatarUrl` as the canonical internal field. Map the provider `image` into `avatarUrl` through the runtime adapter layer, not through schema renaming.
- If the Auth.js adapter requires a direct `image` field, add it as a secondary field or use adapter mapping. This must be validated in the implementation spike.

### `User` relation additions

The `User` model will need new relation fields:

```prisma
authAccounts    AuthAccount[]
authSessions    AuthSession[]
```

These are additive and do not affect existing relations (`sessions`, `memberships`, `createdBusinesses`, etc.).

### Risk Assessment

Auth.js default adapter examples expect `name String?`, `email String?`, `image String?`. Current `User` differs:
- `name` is required (not optional)
- `email` is required (not optional)
- `avatarUrl` instead of `image`

Future spike must verify whether custom mapping is possible with prefixed models and internal field names before committing to this design.

## Proposed AuthAccount Model

> **Note:** This snippet is a proposal only. It must not be applied in this task.

```prisma
model AuthAccount {
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
  @@map("auth_accounts")
}
```

**Purpose:** Links external identity provider accounts (Google, GitHub, email/credentials, etc.) to an internal `User`. Supports multiple providers per user for account linking.

**Key design decisions:**
- Uses UUID `@db.Uuid` for id and userId to match internal convention.
- Uses `onDelete: Cascade` — deleting a User removes associated provider accounts.
- Adds `createdAt`/`updatedAt` for auditability (Auth.js default schema omits these).
- Uses snake_case column mapping via `@map` to match project convention.

## Proposed AuthSession Model

> **Note:** This snippet is a proposal only. It must not be applied in this task.

```prisma
model AuthSession {
  id           String   @id @default(uuid()) @db.Uuid
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id") @db.Uuid
  expires      DateTime
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expires])
  @@map("auth_sessions")
}
```

**Purpose:** Stores Auth.js database sessions separately from the internal `Session` model.

**Key design decisions:**
- Named `AuthSession` to avoid collision with internal `Session`.
- `sessionToken` is the plain session token (not hashed, as Auth.js manages it).
- Uses `onDelete: Cascade` — deleting a User removes associated auth sessions.
- Internal `Session` (with `tokenHash`, `revokedAt`, `ipAddress`, `userAgent`) remains untouched.
- If JWT session strategy is chosen instead, this table may not be needed.

**Coexistence with internal Session:**

| Model | Purpose | Token Storage | Used By |
|---|---|---|---|
| `Session` (internal) | Internal session tracking | Hashed (`tokenHash`) | Application session management |
| `AuthSession` (proposed) | Auth.js provider session | Plain (`sessionToken`) | Auth.js adapter |

Both models relate to `User` via `userId`. They serve different purposes and should not be merged.

## Proposed AuthVerificationToken Model

> **Note:** This snippet is a proposal only. It must not be applied in this task.

```prisma
model AuthVerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
  @@map("auth_verification_tokens")
}
```

**Purpose:** Stores email/magic-link verification tokens. Used by Auth.js for email-based authentication flows.

**Key design decisions:**
- No `id` field — Auth.js uses `@@unique([identifier, token])` as the composite key.
- No `userId` relation — tokens are identified by email identifier, not user FK.
- No `createdAt`/`updatedAt` — tokens are short-lived and deleted after use.
- Matches Auth.js adapter expectations exactly.

## Proposed AuthAuthenticator Model (Deferred)

> **Note:** This model is deferred until WebAuthn/passkey support is adopted. Included here for completeness.

```prisma
model AuthAuthenticator {
  credentialID         String  @unique @map("credential_id")
  userId               String  @map("user_id") @db.Uuid
  providerAccountId    String  @map("provider_account_id")
  credentialPublicKey  String  @map("credential_public_key")
  counter              Int
  credentialDeviceType String  @map("credential_device_type")
  credentialBackedUp   Boolean @map("credential_backed_up")
  transports          String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, credentialID])
  @@map("auth_authenticators")
}
```

**Status:** Not included in initial migration. Only added if WebAuthn/passkeys are adopted.

## Complete Proposed Schema Diff Summary

| Change | Type | Model/Field | Notes |
|---|---|---|---|
| Add field | `User.emailVerified` | `DateTime? @map("email_verified")` | Required for email verification flows |
| Add relation | `User.authAccounts` | `AuthAccount[]` | Auth.js provider account linking |
| Add relation | `User.authSessions` | `AuthSession[]` | Auth.js database sessions |
| New model | `AuthAccount` | 13 fields + indexes | Provider account linking |
| New model | `AuthSession` | 6 fields + indexes | Auth.js database session |
| New model | `AuthVerificationToken` | 3 fields + unique constraint | Email/magic-link tokens |
| Deferred model | `AuthAuthenticator` | 8 fields | WebAuthn/passkeys (future) |
| Unchanged | `Session` | All fields preserved | Internal session model stays as-is |
| Unchanged | `Business` | All fields preserved | Tenant root stays as-is |
| Unchanged | `BusinessMembership` | All fields preserved | Membership stays as-is |
| Unchanged | `AuditEvent` | All fields preserved | Audit trail stays as-is |

## Migration Order

### Phase 1 — Additive-only migration (safe, reversible)

1. Add `emailVerified DateTime?` to `User` table (nullable, no data loss).
2. Create `auth_accounts` table.
3. Create `auth_sessions` table.
4. Create `auth_verification_tokens` table.

All changes are additive. No existing columns are removed or renamed. No existing data is affected.

### Phase 2 — Deferred (only if needed)

5. Create `auth_authenticators` table (only if WebAuthn/passkeys are adopted).
6. Evaluate whether `User.name` should become optional based on spike results.
7. Evaluate whether `User.image` field is needed alongside `avatarUrl`.

### Migration File Naming Convention

Follow existing project convention:

```
prisma/migrations/NNNN_auth_provider_persistence/migration.sql
```

Where `NNNN` is the next sequential migration number.

## Index Strategy

| Table | Index | Type | Purpose |
|---|---|---|---|
| `auth_accounts` | `(user_id)` | Regular | FK lookup |
| `auth_accounts` | `(provider, provider_account_id)` | Unique | Provider account uniqueness |
| `auth_sessions` | `(user_id)` | Regular | FK lookup |
| `auth_sessions` | `(session_token)` | Unique | Session token lookup |
| `auth_sessions` | `(expires)` | Regular | Expiry cleanup queries |
| `auth_verification_tokens` | `(identifier, token)` | Unique | Token lookup |

## Foreign Key Strategy

| Relation | On Delete | Rationale |
|---|---|---|
| `AuthAccount.userId → User.id` | `Cascade` | Deleting a user removes all linked provider accounts |
| `AuthSession.userId → User.id` | `Cascade` | Deleting a user removes all auth sessions |
| `AuthAuthenticator.userId → User.id` | `Cascade` (deferred) | Deleting a user removes all authenticators |

**Note:** `Cascade` is the Auth.js default. This matches the expected adapter behavior but means user deletion is destructive. Consider soft-delete patterns if user recovery is needed.

## Rollback Plan

### Phase 1 Rollback (if migration fails or is rejected)

1. Drop `auth_verification_tokens` table.
2. Drop `auth_sessions` table.
3. Drop `auth_accounts` table.
4. Remove `email_verified` column from `users` table.

All rollback steps are safe because:
- New tables contain no production data at migration time.
- `email_verified` is nullable, so removal has no data loss impact.
- No existing columns or tables are modified.

### Rollback Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| Data loss on rollback | Low | All new columns are nullable; new tables are empty at migration time |
| Broken relations on rollback | Low | New relations are additive; existing relations unchanged |
| Application breakage on rollback | Low | No runtime code depends on new models until implementation task |

## Adapter Compatibility Validation Requirements

Before implementing the migration, the following must be validated in TASK-0029 (spike):

1. **Prefixed model names:** Verify that `@auth/prisma-adapter` can be configured to use `AuthAccount`, `AuthSession`, `AuthVerificationToken` instead of default `Account`, `Session`, `VerificationToken`. If not, evaluate:
   - Custom adapter wrapper
   - Renaming models to match defaults (would require renaming internal `Session` to something like `InternalSession`)
   - Using adapter model name overrides if supported

2. **UUID primary keys:** Verify that the adapter works with `@default(uuid()) @db.Uuid` instead of `@default(cuid())`.

3. **Required User fields:** Verify adapter behavior when `User.name` and `User.email` are required instead of optional.

4. **Prisma 7 compatibility:** Verify that `@auth/prisma-adapter` works with Prisma 7 and `@prisma/adapter-pg`.

5. **prisma.config.ts:** Verify that the adapter works with datasource URL configured through `prisma.config.ts` rather than schema `datasource.url`.

## Session Strategy Decision

This task does not finalize the session strategy. The choice between database sessions and JWT sessions affects schema requirements:

| Strategy | AuthSession table needed? | Pros | Cons |
|---|---|---|---|
| Database sessions | Yes | Server-side session control, immediate revocation | Requires DB lookup per request |
| JWT sessions | No (AuthSession table not needed) | No DB lookup per request, stateless | Harder to revoke, token size limits |

**Recommendation:** Default to database sessions for initial implementation (safer, supports immediate revocation). JWT can be reconsidered later for performance if needed.

## Tenant Context Interaction

- Auth.js schema changes do **not** affect `Business`, `BusinessMembership`, or `AuditEvent`.
- Tenant context resolution continues to flow from `BusinessMembership` after user authentication.
- Auth.js resolves "who is the user?" → internal resolver maps to `BusinessMembership` → tenant context is produced.
- No tenant-related schema changes in this proposal.

## Audit Interaction

- Auth events (login, logout, account link, verification) should eventually produce `AuditEvent` records.
- No new audit-specific schema changes are proposed.
- Future implementation should use existing `AuditEvent` with new action names (e.g., `auth.login`, `auth.logout`, `auth.link_account`).

## Security Considerations

- `AuthAccount.accessToken` and `AuthAccount.refreshToken` store OAuth provider tokens. These are sensitive and should be encrypted at rest in production.
- `AuthSession.sessionToken` is a plain session token managed by Auth.js. Transport must be HTTPS-only.
- `AuthVerificationToken.token` is a short-lived email verification token. Expired tokens should be cleaned up.
- `User.status` must be checked after authentication — suspended/deactivated users must not receive active context.
- Production must **not** enable `ENABLE_DEV_AUTH_CONTEXT`.

## Recommended Future Task Breakdown

| Task | Description | Depends On |
|---|---|---|
| TASK-0029 | Auth.js package and provider spike in isolated branch | TASK-0028 |
| TASK-0030 | Auth provider persistence migration (apply schema changes) | TASK-0029 |
| TASK-0031 | Runtime auth adapter interface implementation | TASK-0030 |
| TASK-0032 | Internal User mapping and account linking tests | TASK-0031 |
| TASK-0033 | Tenant context production resolver design | TASK-0032 |
| TASK-0034 | Auth security hardening checklist | TASK-0033 |
| TASK-0035 | Auth runtime implementation behind feature flag | TASK-0034 |

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

- Concrete schema proposal ready for implementation.
- Clear naming strategy avoids internal Session collision.
- Migration is fully additive and reversible.
- Internal tenant/authz model is untouched.
- Adapter compatibility risks are identified and assigned to spike task.
- Migration order is documented.

### Negative

- Prefixed model names may require custom adapter work (risk assigned to TASK-0029).
- Two session-like tables may cause initial developer confusion.
- Auth.js adapter Prisma 7 compatibility is unverified.
- Session strategy decision is deferred.

## Decision

Accepted schema design proposal: add `emailVerified` to User, create `AuthAccount`, `AuthSession`, and `AuthVerificationToken` models with prefixed names mapping to `auth_*` tables, preserving existing internal Session and all tenant/authz models unchanged.

## Recommended Next Task

[Phase 2] TASK-0029: Auth.js package and provider spike in isolated branch
