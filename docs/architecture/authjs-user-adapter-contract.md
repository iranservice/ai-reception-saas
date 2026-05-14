# Auth.js User Adapter Contract

## Status

Accepted adapter contract; implementation deferred.

## Date

2026-05-14

## Baseline

- **Main commit:** `6668d2d41dbed01fce3de06869e17b47e0e5cca4`
- **Prior migration proposal:** `docs/architecture/auth-provider-persistence-migration-proposal.md`
- **Current task:** TASK-0030B
- **Scope:** Documentation/design only

## Context

- TASK-0030 proposed `Account`, `VerificationToken`, `User.emailVerified`, and JWT session strategy.
- The existing internal `User` is canonical and must remain owned by the application.
- The existing internal `User` differs from default Auth.js user examples because:
  - `name` is required (Auth.js default allows nullable).
  - `email` is required (Auth.js default allows nullable).
  - `avatarUrl` is used instead of `image` (Auth.js default expects `image`).
- Before applying the migration, the project needs a clear adapter contract for user creation and profile mapping.

## Decision

The project will preserve the existing internal `User` contract and introduce an Auth.js adapter boundary in the future runtime task.

The internal `User` model remains canonical.

The future Auth.js integration must not require adding a separate `image` field unless a later adapter spike proves wrapper mapping is impossible.

The future Auth.js integration must not make `name` or `email` nullable in the first migration.

The future adapter layer must provide safe fallbacks for missing provider fields.

## Internal User Contract

Current canonical fields (after future TASK-0031 migration):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `String @db.Uuid` | Yes (auto) | UUID primary key |
| `email` | `String @unique` | Yes | Unique identity anchor |
| `name` | `String` | Yes | Display name |
| `locale` | `String @default("en")` | Yes (default) | User locale |
| `status` | `UserStatus @default(ACTIVE)` | Yes (default) | ACTIVE/SUSPENDED/DEACTIVATED |
| `avatarUrl` | `String?` | No | Canonical avatar/profile image field |
| `emailVerified` | `DateTime?` | No | Added in future migration |
| `createdAt` | `DateTime` | Yes (auto) | Creation timestamp |
| `updatedAt` | `DateTime` | Yes (auto) | Update timestamp |

**Rules:**

- `email` remains required and unique.
- `name` remains required.
- `avatarUrl` remains the canonical avatar/profile image field.
- `image` is not added in the first migration.
- `emailVerified` remains the only User field addition planned in TASK-0031.

## Provider User Mapping Contract

| Provider/Auth.js Field | Internal Field | Rule |
|---|---|---|
| `id` | No direct trust | Provider account id maps through `Account.providerAccountId` |
| `email` | `User.email` | Required; reject or block account creation if missing unless provider-specific verified fallback exists |
| `name` | `User.name` | Required; use provider name if present, else email local-part fallback, else deterministic placeholder |
| `image` | `User.avatarUrl` | Map provider image to `avatarUrl`; do not add `image` field initially |
| `emailVerified` | `User.emailVerified` | Map if provider/email flow supplies verification timestamp |

## Fallback Policy

- **Missing email** is a hard failure for initial provider rollout unless a provider-specific verified email source exists.
- **Missing name** uses fallback:
  1. Provider display name.
  2. Email local-part before `@`.
  3. `"User"` (deterministic placeholder).
- **Missing image** maps to `avatarUrl = null`.
- Provider account id must never become internal `User.id`.
- Provider profile data must not override internal `User.status`.
- Suspended/deactivated users must not receive authenticated context.

## Adapter Strategy Options

### Option A — Change User schema to match Auth.js defaults

Add `image` field, make `name` nullable, potentially make `email` nullable.

**Decision:** Rejected for first migration.

**Reason:** It weakens the internal application identity contract and creates duplicate avatar semantics (`avatarUrl` and `image` serving the same purpose).

### Option B — Use default PrismaAdapter directly and hope schema is sufficient

**Decision:** Rejected.

**Reason:** The project already knows `avatarUrl` vs `image` and required `name`/`email` need explicit mapping/fallback. Using the default adapter directly will silently fail or produce inconsistent data.

### Option C — Add thin adapter wrapper around Auth.js/PrismaAdapter user methods

**Decision:** Accepted direction.

**Reason:** It preserves internal User semantics while adapting provider/Auth.js payloads at the boundary. The wrapper intercepts `createUser` and `updateUser` calls to normalize data before writing, and delegates `Account`/`VerificationToken` persistence directly to the standard adapter.

## Accepted Adapter Direction

Future runtime implementation should use a thin adapter boundary/wrapper that:

- Delegates `Account` and `VerificationToken` persistence to Auth.js-compatible models directly.
- Avoids Auth.js database `Session` initially through JWT strategy.
- Normalizes provider user/profile data before writing `User`.
- Maps provider `image` to `avatarUrl`.
- Enforces required `email` (hard failure if missing).
- Provides fallback `name` (local-part or placeholder).
- Checks or preserves `User.status` semantics (suspended/deactivated users blocked).
- Remains isolated from route handlers and domain services.

## Implications for TASK-0031

TASK-0031 may proceed with schema migration only if it:

- Adds `User.emailVerified`.
- Adds exact `Account`.
- Adds exact `VerificationToken`.
- Does **not** add `User.image`.
- Does **not** make `User.name` nullable.
- Does **not** make `User.email` nullable.
- Does **not** modify internal `Session`.
- Does **not** add Auth.js database `Session`.
- Does **not** implement runtime Auth.js.
- Records that adapter wrapper is required before runtime auth goes live.

## Runtime Implementation Follow-up

Future runtime task must include tests for:

- Provider user with name/email/image.
- Provider user without image.
- Provider user without name.
- Provider user without email.
- Existing suspended user.
- Existing deactivated user.
- Account linking by `provider`/`providerAccountId`.
- Account linking by verified email if allowed.
- Mapping `image` to `avatarUrl`.
- Never trusting provider account id as internal `User.id`.

## Security Notes

- Missing email must not silently create ambiguous accounts.
- Account linking by email must require provider-verified email.
- Provider image URL must be treated as untrusted external input.
- Provider profile data must not override role/status/tenant membership.
- `User.status` must be enforced after authentication.

## Explicit Non-Goals

- No Prisma schema changes
- No migrations
- No package changes
- No Auth.js installation
- No adapter implementation
- No runtime auth
- No tests changed
- No routes changed
- No handlers changed
- No middleware
- No UI
- No env changes

## Decision

Accepted User adapter contract: preserve internal User shape, map provider image to avatarUrl, keep name/email required, add only emailVerified in the first schema migration, and require a thin adapter wrapper before runtime Auth.js goes live.

## Recommended Next Task

[Phase 2] TASK-0031: Apply auth provider persistence migration (Account, VerificationToken, emailVerified)
