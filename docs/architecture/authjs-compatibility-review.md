# Auth.js Compatibility Review and Schema Integration Design

## Status

Accepted compatibility review; implementation deferred.

## Date

2026-05-14

## Baseline

- **Main commit:** `f052d1cd52b93789bd7ff8f4c8affc7b66105f74`
- **Prior ADR:** `docs/architecture/runtime-authentication-strategy.md`
- **Prior checkpoint:** TASK-0025 API handler baseline acceptance checkpoint
- **Current task:** TASK-0027
- **Decision scope:** Documentation/design only

## Context

- TASK-0026 selected provider-abstracted runtime auth with Auth.js as preferred first implementation candidate.
- The project already owns `User`, `Session`, `Business`, `BusinessMembership`, `AuditEvent`.
- The project must preserve internal tenant and authz ownership.
- Auth.js compatibility must be reviewed before schema changes or package installation.
- Current dev auth adapter is not production authentication.

## Current Internal Schema Summary

### User

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` | UUID primary key |
| `email` | `String @unique` | Unique email |
| `name` | `String` | Required (not optional) |
| `locale` | `String @default("en")` | User locale preference |
| `status` | `UserStatus @default(ACTIVE)` | ACTIVE/SUSPENDED/DEACTIVATED |
| `avatarUrl` | `String?` | Maps to `avatar_url` |
| `createdAt` | `DateTime @default(now())` | Maps to `created_at` |
| `updatedAt` | `DateTime @updatedAt` | Maps to `updated_at` |

Notes:
- Email is unique.
- Name is **required** (Auth.js expects optional).
- No `emailVerified` field exists.
- `avatarUrl` maps to `avatar_url` (Auth.js expects `image`).
- User already relates to sessions, memberships, businesses, and audit events.

### Session

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` | UUID primary key |
| `userId` | `String @db.Uuid` | FK to User |
| `tokenHash` | `String @unique` | Hashed session token |
| `expiresAt` | `DateTime` | Expiration timestamp |
| `revokedAt` | `DateTime?` | Revocation timestamp |
| `ipAddress` | `String?` | Client IP |
| `userAgent` | `String?` | Client user agent |
| `createdAt` | `DateTime @default(now())` | Creation timestamp |
| `updatedAt` | `DateTime @updatedAt` | Update timestamp |

Notes:
- This is an internal hashed-token session model.
- It is **not** declared compatible with Auth.js adapter sessions.
- Auth.js expects `sessionToken` (unhashed unique string) and `expires`, not `tokenHash`/`expiresAt`/`revokedAt`.
- Do not assume it can replace Auth.js Session without design work.

### Business / BusinessMembership

- `Business` is the tenant root entity with `id`, `name`, `slug`, `status`, `timezone`, `locale`, `createdByUserId`.
- `BusinessMembership` is the source of tenant role (`MembershipRole`) and membership status (`MembershipStatus`).
- These must remain internal and must **not** be replaced by provider organization models.

### AuditEvent

- `AuditEvent` is the internal audit trail with actor type, action, target, result, and metadata.
- Auth provider events may later be normalized into AuditEvent.
- No schema change in this task.

## Auth.js Adapter Expectations

The following is based on official Auth.js Prisma Adapter documentation at [authjs.dev/getting-started/adapters/prisma](https://authjs.dev/getting-started/adapters/prisma), verified 2026-05-14.

### Required Models (from official docs)

The Auth.js Prisma Adapter expects the following models:

#### User (Auth.js expected)

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime? @map("email_verified")
  image         String?
  accounts      Account[]
  sessions      Session[]
  @@map("users")
}
```

Key differences from internal schema:
- Auth.js `name` is **optional**; internal schema requires it.
- Auth.js expects `emailVerified` (`DateTime?`); internal schema lacks it.
- Auth.js expects `image`; internal schema uses `avatarUrl`.
- Auth.js uses `@default(cuid())`; internal schema uses `@default(uuid()) @db.Uuid`.
- Auth.js `email` is optional; internal schema requires it.

#### Account (Auth.js expected — not in current schema)

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String  @map("user_id")
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@map("accounts")
}
```

Purpose: Links external identity provider accounts (Google, GitHub, etc.) to an internal User.

#### Session (Auth.js expected — incompatible with internal Session)

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("sessions")
}
```

Key differences from internal Session:
- Auth.js stores plain `sessionToken`; internal stores `tokenHash`.
- Auth.js has `expires`; internal has `expiresAt` + `revokedAt`.
- Auth.js has no `ipAddress`/`userAgent`; internal has both.
- Semantics are fundamentally different.

#### VerificationToken (Auth.js expected — not in current schema)

```prisma
model VerificationToken {
  identifier String
  token      String
  expires    DateTime
  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

Purpose: Used for email/magic-link verification flows.

#### Authenticator (optional, for WebAuthn/passkeys)

Auth.js documents an optional `Authenticator` model for WebAuthn support. This is marked as experimental (`🔬`) in official docs and is not required for initial integration.

### Session Strategy Options

Auth.js supports two session strategies:

1. **Database sessions** (`strategy: "database"`) — stores sessions in the database via the adapter. Requires the Session model.
2. **JWT sessions** (`strategy: "jwt"`) — stores session data in an encrypted JWT cookie. Does not require a database Session model but still requires User and Account.

### Adapter Package

The official Prisma adapter package is `@auth/prisma-adapter`. It is installed alongside `next-auth` (Auth.js for Next.js).

### Prisma 7 Compatibility

The official Auth.js docs reference Prisma `@prisma/client@5.12.0` for edge compatibility. No explicit Prisma 7 documentation was found on authjs.dev. The project uses Prisma 7 with `@prisma/adapter-pg` and `prisma.config.ts`-based URL configuration, which differs from the standard `datasource.url` approach. Compatibility must be verified in a future spike task.

## Compatibility Gap Analysis

| Area | Current Repo State | Auth.js Expectation | Compatibility Status | Notes |
|---|---|---|---|---|
| User.id | `uuid() @db.Uuid` | `cuid()` | ⚠️ Compatible with adapter config | Auth.js adapter works with any string ID; UUID is fine |
| User.email | `String @unique` (required) | `String? @unique` (optional) | ⚠️ Partially compatible | Internal requires email; Auth.js allows null. Compatible if all users have email |
| User.name | `String` (required) | `String?` (optional) | ⚠️ Partially compatible | Internal requires name; Auth.js may create user without name from OAuth. Needs default/migration handling |
| User.emailVerified | Missing | `DateTime?` | ❌ Gap | Must be added for email/magic-link verification flows |
| User.image / avatar | `avatarUrl String?` | `image String?` | ⚠️ Naming mismatch | Can use `@map` or adapter mapping. Needs design decision |
| Account model | Missing | Required for OAuth/provider linking | ❌ Gap | Must be created |
| Session model | Internal `tokenHash`-based | `sessionToken`-based or JWT | ❌ Incompatible | Different semantics; cannot reuse directly |
| VerificationToken model | Missing | Required for email/magic-link | ❌ Gap | Must be created if email verification is used |
| Authenticator model | Missing | Optional (WebAuthn) | ⏸️ Deferred | Not needed for initial integration |
| Provider account linking | Not implemented | Via Account model | ❌ Gap | Requires Account model |
| Internal BusinessMembership | Exists, internal | Not an Auth.js concern | ✅ No conflict | Must remain internal |
| Internal AuthzPermission | Exists, internal | Not an Auth.js concern | ✅ No conflict | Must remain internal |
| AuditEvent | Exists, internal | Not an Auth.js concern | ✅ No conflict | Can record normalized auth events later |

## Integration Options

### Option A — Reuse existing User and replace/extend Session for Auth.js

**Approach:** Modify the internal `Session` model to match Auth.js expectations (replace `tokenHash` with `sessionToken`, remove `revokedAt`/`ipAddress`/`userAgent`).

**Pros:**
- Fewer tables.
- Simpler naming.
- Direct user identity mapping.

**Cons:**
- Existing `Session` has internal `tokenHash` semantics that would be lost.
- Risk of mixing internal session management logic with provider sessions.
- Harder rollback if Auth.js session model changes.
- Loses `ipAddress`/`userAgent` tracking capability from current model.
- Cannot maintain both internal and provider session patterns simultaneously.

**Decision:** Not recommended as first design.

### Option B — Reuse User, add Auth.js-specific Account/Session/VerificationToken tables

**Approach:** Keep the internal `User` as canonical. Add new `emailVerified` field to User. Add separate `AuthAccount`, `AuthSession`, and `VerificationToken` models alongside the existing internal `Session`.

**Pros:**
- Preserves internal User identity as the single source of application identity.
- Avoids mixing internal session semantics with provider sessions.
- Aligns with adapter expectations more cleanly.
- Keeps BusinessMembership/Authz completely untouched.
- Internal `Session` can continue to serve internal session tracking (IP, user agent, revocation) if needed.

**Cons:**
- Requires schema migration to add `emailVerified` to User and create new tables.
- Requires mapping Auth.js session user to internal User.
- Requires careful table naming and relations to avoid confusion.
- Two session-like tables may cause confusion if not clearly documented.

**Decision:** Recommended direction for future schema design.

### Option C — Fully separate AuthUser/AuthAccount/AuthSession and map to internal User

**Approach:** Create a completely separate `AuthUser` model that Auth.js owns, then map `AuthUser` to internal `User` through a linking table or lookup.

**Pros:**
- Maximum isolation from internal User model.
- Lowest risk to internal schema.
- Auth.js can evolve independently.

**Cons:**
- Duplicate identity model creates mapping complexity.
- More mapping logic required at every auth boundary.
- More complex account linking.
- May slow development significantly.
- Redundant user data storage.

**Decision:** Track as fallback if direct User reuse becomes unsafe.

## Recommended Schema Direction

Use existing internal `User` as the canonical application user.

Add Auth.js-specific persistence models in a future schema task, likely:

- `AuthAccount` or `Account` — provider account linkage
- `AuthSession` or `ProviderSession` — Auth.js database session (if database session strategy is chosen)
- `VerificationToken` — email/magic-link verification
- Optional `Authenticator` — if passkeys/WebAuthn are adopted later

**Preferred naming strategy:** Use explicit `Auth*` or `Provider*` prefixes if needed to avoid confusion with the existing internal `Session` model. Exact naming must be decided in TASK-0028 or equivalent schema design task.

**User model changes needed:**
- Add `emailVerified DateTime?` field (mapped to `email_verified`)
- Evaluate whether `name` should become optional or retain a default
- Evaluate whether `avatarUrl` should be aliased as `image` or mapped via adapter

## User Mapping Strategy

- Auth.js authenticated user maps to internal `User`.
- Internal `User` remains the source for application identity.
- Provider account identity should map to `User` through provider account linkage (`Account` model).
- Email uniqueness needs careful handling for account linking — two providers with the same email should link to the same User.
- Existing `User.status` must be checked before producing authenticated context.
- Suspended/deactivated users must **not** receive active authenticated context in future runtime implementation.

## Session Mapping Strategy

- API handlers must never see raw Auth.js session tokens.
- Request context resolver should validate provider session and return internal context.
- Existing internal `Session` model should **not** be reused blindly for Auth.js sessions.
- If Auth.js database sessions are used, separate provider session storage is needed (e.g., `AuthSession`).
- If Auth.js JWT sessions are used, database session table needs may differ — JWT strategy requires no database session model but still needs Account.
- Final session strategy (database vs. JWT) must be decided before migration.

## Tenant Context Mapping Strategy

- Auth.js resolves only user identity ("who is this user?").
- Tenant context must be resolved from internal `BusinessMembership`.
- `x-dev-business-id` currently used in dev adapter must be replaced by a production tenant selection mechanism later.
- Production tenant selection may come from:
  - Route `businessId` parameter
  - Selected workspace header
  - Session-scoped active business
  - Explicit tenant switch endpoint
- This task does not choose final tenant selection UX.

## Authz Strategy

- Auth.js does **not** replace `AuthzService`.
- `MembershipRole` and `AuthzPermission` remain internal.
- Handlers continue to use context role and domain authz checks.
- Role/permission evaluation must remain independent of provider.

## Audit Strategy

- Auth login/logout/failure/account-link events should be normalized into `AuditEvent` later.
- Provider-specific event payloads must not be stored raw without review.
- `AuditEvent` schema may need future action names (e.g., `auth.login`, `auth.logout`, `auth.link_account`) but no schema change now.

## Environment / Secrets Strategy

No environment variables are added in this task.

Possible future variables (conceptual only):

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Signing key for Auth.js sessions/JWTs |
| `AUTH_URL` or `NEXTAUTH_URL` | Public auth callback URL |
| Provider client ID/secret | OAuth provider credentials (e.g., `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) |
| Runtime auth feature flag | Gradual migration control |
| `ENABLE_DEV_AUTH_CONTEXT` | Must be **prohibited** in production |

## Prisma 7 Considerations

- Current project uses Prisma 7 (`^7`) and `@prisma/adapter-pg` (`^7.8.0`).
- Prisma datasource URL is configured through `prisma.config.ts`, not schema `datasource.url`.
- Auth.js official docs reference `@prisma/client@5.12.0` for edge compatibility; no explicit Prisma 7 documentation was found.
- `@auth/prisma-adapter` compatibility with Prisma 7 must be verified in a future spike task before installation.
- Any Auth.js adapter example assuming older Prisma config must be adapted carefully for the `prisma.config.ts` pattern.
- No Prisma schema changes are made in this task.

## Security Review Points for Future Implementation

- CSRF behavior for auth routes
- Secure cookie settings (HttpOnly, Secure, SameSite)
- Session rotation after login
- Account linking rules (same email = same user?)
- Email verification policy (require verified email before access?)
- Disabled/suspended user enforcement (check `User.status` post-auth)
- Tenant membership lookup after authentication
- Production rejection of dev auth headers
- Audit logging for auth-sensitive operations
- Rate limiting for login and callback endpoints
- Secrets validation (AUTH_SECRET length/entropy)
- OAuth provider callback URL validation

## Recommended Future Task Breakdown

| Task | Description |
|---|---|
| TASK-0028 | Auth.js schema design and migration proposal |
| TASK-0029 | Auth.js package and provider spike in isolated branch |
| TASK-0030 | Runtime auth adapter interface implementation |
| TASK-0031 | Internal User mapping and account linking tests |
| TASK-0032 | Tenant context production resolver design |
| TASK-0033 | Auth security hardening checklist |
| TASK-0034 | Auth runtime implementation behind feature flag |

## Explicit Non-Goals

- No Auth.js installation
- No `@auth/prisma-adapter` installation
- No provider installation
- No route changes
- No auth callback route
- No login/signup UI
- No middleware
- No Prisma schema changes
- No migrations
- No package changes
- No env changes
- No handler changes
- No test changes
- No real authentication
- No production session implementation

## Consequences

### Positive

- Clear understanding of compatibility gaps before implementation.
- Preserves internal tenant and authz model.
- Identifies minimum schema changes needed (add `emailVerified`, create `Account`/`AuthSession`/`VerificationToken`).
- Documents that internal `Session` should not be blindly reused.
- Avoids premature schema changes.

### Negative

- Production auth remains unimplemented.
- Prisma 7 compatibility with `@auth/prisma-adapter` is unverified.
- Schema migration work is required before runtime auth can be implemented.
- Session strategy decision (database vs. JWT) is deferred.

## Decision

Recommended future direction: reuse internal User as canonical application user, add separate Auth.js-compatible provider account/session/token persistence models in a future schema task, and keep BusinessMembership/Authz internal.

## Recommended Next Task

[Phase 2] TASK-0028: Auth.js schema design and migration proposal
