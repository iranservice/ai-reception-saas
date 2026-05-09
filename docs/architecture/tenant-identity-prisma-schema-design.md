# Tenant and Identity Prisma Schema Design

## Purpose

Design the first planned Prisma schema slice for tenant, identity, membership, roles, permissions, and audit foundations.

This document is design only. It does not modify prisma/schema.prisma and does not create migrations.

## Scope

In scope:

- User
- Session
- Business
- BusinessMembership
- Role
- Permission
- RolePermission
- PolicyRule
- AuditEvent

Out of scope:

- Customer
- Conversation
- Message
- Channel
- AI Draft
- Knowledge Source
- Billing
- Analytics
- Provider integrations

## Design Principles

- Tenant-owned data is business-scoped
- Users are global identities
- Membership links users to businesses
- Access decisions are server-side
- Audit events preserve actor and tenant context
- Schema should support soft lifecycle states instead of hard deletes
- Schema should avoid provider-specific fields
- Schema should be explicit and testable

## Prisma Naming Conventions

- Prisma models use PascalCase
- Database table names use snake_case via `@@map`
- Database columns use snake_case via `@map` where needed
- IDs use `String` with `@db.Uuid`
- Timestamps use `DateTime`
- JSON uses `Json`
- Enums use PascalCase enum names and SCREAMING_SNAKE_CASE values
- Unique constraints must be named where useful
- Indexes must support tenant-scoped queries

## Planned Enums

### UserStatus

| Value | Meaning |
|---|---|
| `ACTIVE` | Normal operating state. User can log in. |
| `SUSPENDED` | Temporarily disabled by admin or system. Cannot log in. Reversible. |
| `DEACTIVATED` | Permanently disabled. Cannot log in. Not reversible. |

### BusinessStatus

| Value | Meaning |
|---|---|
| `ACTIVE` | Normal operating state. Members can access. |
| `SUSPENDED` | Temporarily disabled by platform admin. Members cannot access. |
| `ARCHIVED` | Voluntarily deactivated by business owner. Members cannot access. |

### MembershipStatus

| Value | Meaning |
|---|---|
| `INVITED` | Invitation sent, not yet accepted. |
| `ACTIVE` | Active member with access. |
| `DECLINED` | User declined the invitation. |
| `EXPIRED` | Invitation expired. |
| `REMOVED` | Removed by admin/owner. |
| `LEFT` | User voluntarily left. |

### MembershipRole

| Value | Meaning |
|---|---|
| `OWNER` | Business creator/owner. Full control. Exactly one per business. |
| `ADMIN` | Administrative access. Manages settings and team. |
| `OPERATOR` | Front-line operator. Handles conversations. |
| `VIEWER` | Read-only access. |

### AuditActorType

| Value | Meaning |
|---|---|
| `USER` | Human user action. |
| `SYSTEM` | Background/system-originated operation. |
| `AI_RECEPTIONIST` | Future AI-assisted action. |

### AuditResult

| Value | Meaning |
|---|---|
| `SUCCESS` | Action completed successfully. |
| `DENIED` | Action was denied by permission check. |
| `FAILED` | Action failed due to error. |

## Planned Models

### User Model

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | `@id @default(uuid()) @db.Uuid` | Unique user identifier |
| `email` | String | `@unique`, not null | User email address (login identifier) |
| `name` | String | not null | User display name |
| `locale` | String | `@default("en")`, not null | Preferred UI language |
| `status` | UserStatus | `@default(ACTIVE)`, not null | Account status |
| `avatarUrl` | String? | nullable | Profile image URL |
| `createdAt` | DateTime | `@default(now())` | Account creation time |
| `updatedAt` | DateTime | `@updatedAt` | Last modification time |

Relations:

- `sessions` → Session[] (one-to-many)
- `memberships` → BusinessMembership[] (one-to-many)
- `createdBusinesses` → Business[] (one-to-many, via `createdByUserId`)
- `auditEvents` → AuditEvent[] (one-to-many, via `actorUserId`)

Indexes:

- `email` unique index
- `status` optional index for filtered queries

Database table: `users` via `@@map("users")`

### Session Model

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | `@id @default(uuid()) @db.Uuid` | Session identifier |
| `userId` | String | `@db.Uuid`, FK → User, not null | Session owner |
| `tokenHash` | String | `@unique`, not null | Hashed session token |
| `expiresAt` | DateTime | not null | Session expiry time |
| `revokedAt` | DateTime? | nullable | When revoked (null = active) |
| `ipAddress` | String? | nullable | Client IP for audit |
| `userAgent` | String? | nullable | Client user agent for audit |
| `createdAt` | DateTime | `@default(now())` | Session creation time |
| `updatedAt` | DateTime | `@updatedAt` | Last modification time |

Relations:

- `user` → User (many-to-one)

Indexes:

- `tokenHash` unique index
- `userId` index
- `expiresAt` index
- `revokedAt` index (for active session queries)

Database table: `sessions` via `@@map("sessions")`

Important: Never store raw session tokens. Only the hash is persisted. The raw token exists only in the client cookie.

### Business Model

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | `@id @default(uuid()) @db.Uuid` | Business identifier |
| `name` | String | not null | Business display name |
| `slug` | String | `@unique`, not null | URL-safe business identifier |
| `status` | BusinessStatus | `@default(ACTIVE)`, not null | Business status |
| `timezone` | String | `@default("Asia/Tehran")`, not null | IANA timezone |
| `locale` | String | `@default("fa")`, not null | Default business language |
| `createdByUserId` | String | `@db.Uuid`, FK → User, not null | Founding user |
| `createdAt` | DateTime | `@default(now())` | Creation time |
| `updatedAt` | DateTime | `@updatedAt` | Last modification time |

Relations:

- `createdByUser` → User (many-to-one)
- `memberships` → BusinessMembership[] (one-to-many)
- `auditEvents` → AuditEvent[] (one-to-many)

Indexes:

- `slug` unique index
- `status` index
- `createdByUserId` index

Database table: `businesses` via `@@map("businesses")`

### BusinessMembership Model

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | `@id @default(uuid()) @db.Uuid` | Membership identifier |
| `businessId` | String | `@db.Uuid`, FK → Business, not null | Business reference |
| `userId` | String | `@db.Uuid`, FK → User, not null | User reference |
| `role` | MembershipRole | not null | Role in this business |
| `status` | MembershipStatus | `@default(INVITED)`, not null | Membership status |
| `invitedByUserId` | String? | `@db.Uuid`, FK → User, nullable | Who invited |
| `joinedAt` | DateTime? | nullable | When accepted |
| `createdAt` | DateTime | `@default(now())` | Record creation time |
| `updatedAt` | DateTime | `@updatedAt` | Last modification time |

Relations:

- `business` → Business (many-to-one)
- `user` → User (many-to-one)
- `invitedByUser` → User (many-to-one, optional)

Constraints:

- `@@unique([userId, businessId])` — a user can have at most one membership record per business

Indexes:

- `businessId` index
- `userId` index
- `businessId, role` composite index
- `businessId, status` composite index

Database table: `business_memberships` via `@@map("business_memberships")`

#### Membership Uniqueness Decision

**Recommended approach for MVP:** Use `@@unique([userId, businessId])` as a simple constraint. Keep historical status on the same row (e.g., `REMOVED`, `LEFT`).

**Rationale:**

- Simplest model — one row per user-business pair.
- Status changes update the existing row rather than creating new rows.
- No need for partial indexes in the initial implementation.
- If a removed user is re-invited, the existing row is updated back to `INVITED`.

**Trade-off acknowledged:**

- Historical membership transitions are not preserved as separate records. If membership history is needed, a separate `MembershipHistory` table can be added later.
- This is acceptable for MVP because audit events already capture membership changes.

### Role Model

**Decision: Deferred for MVP.**

For MVP, `MembershipRole` enum is sufficient. A separate `Role` table is not created.

**Rationale:**

- Roles are fixed (owner, admin, operator, viewer).
- No custom roles in MVP.
- Simpler permission checks — no joins needed.
- Can migrate to a Role table later when custom roles are needed.

**Future migration path:**

1. Create `Role` table with id, name, description.
2. Create `RolePermission` join table.
3. Add `roleId` FK to `BusinessMembership`.
4. Migrate existing enum values to Role records.
5. Remove `MembershipRole` enum or keep as seed data reference.

### Permission Model

**Decision: Deferred for MVP.**

For MVP, permissions are hardcoded in application code as a `Map<MembershipRole, string[]>` referencing the access control matrix in `docs/architecture/access-control-matrix.md`.

**Rationale:**

- Permission set is stable for MVP.
- Simpler implementation — no DB lookups for permission checks.
- Avoids premature admin UI for custom permissions.

**Future migration path:**

1. Create `Permission` table with id, resource, action, description.
2. Seed initial permissions from access control matrix.
3. Replace hardcoded map with DB-backed permission lookup.

### RolePermission Model

**Decision: Deferred for MVP.**

Not needed until both `Role` and `Permission` become tables.

**Future migration path:**

1. Create `RolePermission` join table linking Role to Permission.
2. Seed initial mappings from access control matrix.

### PolicyRule Model

**Decision: Deferred for MVP.**

**Future use cases:**

- Custom policy rules per business
- ABAC (attribute-based access control)
- Location-scoped access
- Own-conversation access restrictions
- Per-user permission overrides

### AuditEvent Model

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String | `@id @default(uuid()) @db.Uuid` | Event identifier |
| `businessId` | String? | `@db.Uuid`, FK → Business, nullable | Tenant context (null for global events) |
| `actorType` | AuditActorType | not null | Type of actor |
| `actorUserId` | String? | `@db.Uuid`, FK → User, nullable | User actor (null for SYSTEM/AI) |
| `action` | String | not null | Action name (e.g., `member.invited`) |
| `targetType` | String? | nullable | Target entity type (e.g., `BusinessMembership`) |
| `targetId` | String? | nullable | Target entity ID |
| `result` | AuditResult | not null | Outcome of the action |
| `metadata` | Json? | nullable | Additional context |
| `createdAt` | DateTime | `@default(now())` | Event time |

Relations:

- `business` → Business (many-to-one, optional)
- `actorUser` → User (many-to-one, optional)

Indexes:

- `businessId, createdAt` composite index (primary query path)
- `actorUserId, createdAt` composite index
- `action` index
- `targetType, targetId` composite index
- `result` index

Database table: `audit_events` via `@@map("audit_events")`

Important: AuditEvent is append-only at the application layer. No updates or deletes are allowed by the service layer.

## Proposed Prisma Snippets

The following snippets are **documentation only**. They illustrate the planned schema but do **not** modify `prisma/schema.prisma`.

### Enums

```prisma
enum UserStatus {
  ACTIVE
  SUSPENDED
  DEACTIVATED
}

enum BusinessStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum MembershipStatus {
  INVITED
  ACTIVE
  DECLINED
  EXPIRED
  REMOVED
  LEFT
}

enum MembershipRole {
  OWNER
  ADMIN
  OPERATOR
  VIEWER
}

enum AuditActorType {
  USER
  SYSTEM
  AI_RECEPTIONIST
}

enum AuditResult {
  SUCCESS
  DENIED
  FAILED
}
```

### User

```prisma
model User {
  id        String     @id @default(uuid()) @db.Uuid
  email     String     @unique
  name      String
  locale    String     @default("en")
  status    UserStatus @default(ACTIVE)
  avatarUrl String?    @map("avatar_url")
  createdAt DateTime   @default(now()) @map("created_at")
  updatedAt DateTime   @updatedAt @map("updated_at")

  sessions           Session[]
  memberships        BusinessMembership[]
  createdBusinesses  Business[]           @relation("BusinessCreator")
  invitedMemberships BusinessMembership[] @relation("MembershipInviter")
  auditEvents        AuditEvent[]         @relation("AuditActor")

  @@map("users")
}
```

### Session

```prisma
model Session {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  ipAddress String?   @map("ip_address")
  userAgent String?   @map("user_agent")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}
```

### Business

```prisma
model Business {
  id              String         @id @default(uuid()) @db.Uuid
  name            String
  slug            String         @unique
  status          BusinessStatus @default(ACTIVE)
  timezone        String         @default("Asia/Tehran")
  locale          String         @default("fa")
  createdByUserId String         @map("created_by_user_id") @db.Uuid
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  createdByUser User                 @relation("BusinessCreator", fields: [createdByUserId], references: [id])
  memberships   BusinessMembership[]
  auditEvents   AuditEvent[]

  @@index([status])
  @@index([createdByUserId])
  @@map("businesses")
}
```

### BusinessMembership

```prisma
model BusinessMembership {
  id              String           @id @default(uuid()) @db.Uuid
  businessId      String           @map("business_id") @db.Uuid
  userId          String           @map("user_id") @db.Uuid
  role            MembershipRole
  status          MembershipStatus @default(INVITED)
  invitedByUserId String?          @map("invited_by_user_id") @db.Uuid
  joinedAt        DateTime?        @map("joined_at")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  business      Business @relation(fields: [businessId], references: [id])
  user          User     @relation(fields: [userId], references: [id])
  invitedByUser User?    @relation("MembershipInviter", fields: [invitedByUserId], references: [id])

  @@unique([userId, businessId])
  @@index([businessId])
  @@index([userId])
  @@index([businessId, role])
  @@index([businessId, status])
  @@map("business_memberships")
}
```

### AuditEvent

```prisma
model AuditEvent {
  id            String         @id @default(uuid()) @db.Uuid
  businessId    String?        @map("business_id") @db.Uuid
  actorType     AuditActorType @map("actor_type")
  actorUserId   String?        @map("actor_user_id") @db.Uuid
  action        String
  targetType    String?        @map("target_type")
  targetId      String?        @map("target_id")
  result        AuditResult
  metadata      Json?
  createdAt     DateTime       @default(now()) @map("created_at")

  business  Business? @relation(fields: [businessId], references: [id])
  actorUser User?     @relation("AuditActor", fields: [actorUserId], references: [id])

  @@index([businessId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([action])
  @@index([targetType, targetId])
  @@index([result])
  @@map("audit_events")
}
```

## Relationship Rules

- User can have many sessions
- User can have many memberships
- Business can have many memberships
- BusinessMembership connects User and Business
- AuditEvent can reference User actor optionally
- AuditEvent must preserve tenant context when tenant-scoped

## Tenant Isolation Rules

- All tenant data must be queried by `businessId`
- BusinessMembership is the gate for tenant access
- Public endpoints must never trust client-provided `businessId` alone
- Service layer must verify active membership before tenant data access
- Audit events must preserve `businessId` when applicable

## Deletion and Lifecycle Rules

- User is not hard-deleted — status-based lifecycle
- Business is not hard-deleted — status-based lifecycle
- BusinessMembership is not hard-deleted — status-based lifecycle
- Session can be revoked via `revokedAt` timestamp
- AuditEvent is append-only — no updates or deletes
- Status fields represent lifecycle transitions, not physical deletion

## Migration Strategy

Future implementation sequence (not executed in this task):

1. Add enums to schema
2. Add User model
3. Add Session model
4. Add Business model
5. Add BusinessMembership model
6. Add AuditEvent model
7. Generate Prisma client
8. Add schema tests
9. Create migration
10. Run migration locally only when DB is ready

No migration should be created in this task.

## Validation Rules

Service-layer validation (to be implemented in future tasks):

- Email lowercasing on write
- Slug format: `^[a-z0-9][a-z0-9-]*[a-z0-9]$`, minimum 3 characters
- Locale allowlist: `['en', 'fa']`
- Timezone validation against IANA timezone database
- Owner last-member protection: cannot remove or downgrade the last owner
- Role transition validation: only valid transitions allowed
- Membership status transition validation: only valid transitions allowed

## Open Questions

- Exact auth provider (magic link, OAuth, or external provider like Clerk)
- Whether Session is app-owned or provider-owned (affects Session model necessity)
- Whether AuditEvent should be in the first schema implementation or a follow-up task
- Whether Role and Permission stay hardcoded for the entire MVP or get tables earlier
- Whether partial indexes are needed later for membership history (e.g., unique active membership only)

## Non-Goals

- No Prisma schema changes
- No migrations
- No runtime auth implementation
- No API routes
- No UI
- No provider SDKs
- No customer/conversation/message models
