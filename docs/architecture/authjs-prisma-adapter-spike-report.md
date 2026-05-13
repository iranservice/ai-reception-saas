# Auth.js Prisma Adapter Spike Report

## Status

Spike completed; findings documented. Final PR is documentation-only.

## Date

2026-05-14

## Baseline

- **Main commit:** `bbcb00e4519d72e0314bb0ce57000afa1e7d2290`
- **Prior schema design:** `docs/architecture/authjs-schema-design.md`
- **Current task:** TASK-0029
- **Decision scope:** Spike validation only

## Context

TASK-0028 proposed prefixed model names (`AuthAccount`, `AuthSession`, `AuthVerificationToken`) to avoid collision with the existing internal `Session` model. This spike validates whether that naming strategy works with the actual `@auth/prisma-adapter` package.

## Temporary Spike Packages Tested

The following packages were temporarily installed during local branch research and intentionally reverted before PR acceptance. They are **not** part of the final PR diff.

| Package | Version | Purpose |
|---|---|---|
| `next-auth` | `5.0.0-beta.31` | Auth.js v5 for Next.js |
| `@auth/prisma-adapter` | `2.11.2` | Prisma adapter for Auth.js |

> These changes were used during local spike validation and intentionally reverted before PR acceptance. They are not part of the final PR diff.

## Temporary Spike Schema Changes Tested

The following schema additions were temporarily applied to `prisma/schema.prisma` during local spike research and intentionally reverted before PR acceptance. They are **not** part of the final PR diff.

- `User.emailVerified DateTime? @map("email_verified")` — new field
- `User.authAccounts AuthAccount[]` — new relation
- `User.authSessions AuthSession[]` — new relation
- `AuthAccount` model — provider account linking (mapped to `auth_accounts`)
- `AuthSession` model — Auth.js database session (mapped to `auth_sessions`)
- `AuthVerificationToken` model — email verification token (mapped to `auth_verification_tokens`)

> These changes were used during local spike validation and intentionally reverted before PR acceptance. They are not part of the final PR diff.

## Temporary Spike Source/Test Files

The following files were temporarily created during local spike research and removed before PR acceptance. They are **not** part of the final PR diff.

- `src/spikes/authjs/authjs-spike-config.ts` — compile-time adapter validation
- `__tests__/spikes/authjs-prisma-adapter-spike.test.ts` — 17 spike tests

> These files were used during local spike validation and intentionally removed before PR acceptance. They are not part of the final PR diff.

## Validation Results

### Scenario A — Prefixed Model Names

| Check | Result | Notes |
|---|---|---|
| `prisma:format` | ✅ Pass | Schema with prefixed names is valid Prisma syntax |
| `prisma:generate` | ✅ Pass | Client generates with AuthAccount/AuthSession/AuthVerificationToken delegates |
| `typecheck` | ✅ Pass | All TypeScript compilation passes |
| Adapter delegate names | ❌ **Mismatch** | `PrismaAdapter` expects `prisma.account`, `prisma.session`, `prisma.verificationToken` — our schema generates `prisma.authAccount`, `prisma.authSession`, `prisma.authVerificationToken` |

**Conclusion:** Prefixed model names compile and generate correctly, but the default `PrismaAdapter` will fail at runtime because it accesses `prisma.account` (not `prisma.authAccount`) internally.

### Scenario B — Adapter Delegate Name Analysis

The `@auth/prisma-adapter` `PrismaAdapter` function accesses these delegate names:
- `prisma.user` ✅ — exists in our schema
- `prisma.account` ❌ — we have `prisma.authAccount`
- `prisma.session` ⚠️ — exists but is our **internal** `Session` (hashed-token), not Auth.js session
- `prisma.verificationToken` ❌ — we have `prisma.authVerificationToken`

**Recommended resolution:**

| Model | TASK-0028 Proposed | Spike Finding | Recommended |
|---|---|---|---|
| Account | `AuthAccount` | Adapter expects `Account` | Rename to `Account` (no internal conflict) |
| VerificationToken | `AuthVerificationToken` | Adapter expects `VerificationToken` | Rename to `VerificationToken` (no internal conflict) |
| Session | `AuthSession` | Adapter expects `Session` (conflicts with internal) | Use **JWT session strategy** initially — no adapter Session table needed |
| Internal Session | `Session` (unchanged) | No conflict with JWT strategy | Keep as-is |

### Scenario C — UUID Compatibility

| Check | Result | Notes |
|---|---|---|
| `prisma:generate` with `@db.Uuid` | ✅ Pass | Client generates correctly with UUID primary keys |
| `typecheck` with UUID ids | ✅ Pass | No type errors |

**Conclusion:** UUID primary keys are fully compatible with the Prisma adapter. No need to switch to `cuid()`.

### Scenario D — Required User Fields

| Check | Result | Notes |
|---|---|---|
| Required `email` + `name` | ✅ Compiles | Schema/client generation succeeds |
| `emailVerified` field | ✅ Added | New nullable DateTime field compiles correctly |
| `avatarUrl` vs `image` | ✅ No compile issue | Runtime mapping needed in adapter layer |

**Concern:** Auth.js adapter `createUser` may pass `null`/`undefined` for `name` and `email` from some OAuth providers. This is a **runtime concern** — schema compilation succeeds, but the application must provide fallback values during user creation. This should be handled in the adapter wrapper layer.

### Scenario E — Prisma 7 + @prisma/adapter-pg

| Check | Result | Notes |
|---|---|---|
| `@auth/prisma-adapter` install | ✅ Pass | Installs alongside Prisma 7 without conflicts |
| `@prisma/adapter-pg` import | ✅ Pass | Existing adapter remains importable |
| `prisma:generate` | ✅ Pass | Prisma 7 client generates with spike schema |
| `prisma.config.ts` | ✅ Compatible | Config pattern not affected by adapter package |

**Conclusion:** `@auth/prisma-adapter@2.11.2` is compatible with Prisma 7 at the package/compilation level. Runtime DB adapter compatibility requires a live DB test in a future task.

## Key Findings

### Finding 1 — Prefixed names partially incompatible with default adapter

The TASK-0028 proposed `Auth*` prefix naming strategy does **not** work directly with the default `PrismaAdapter`. The adapter accesses `prisma.account`, `prisma.session`, `prisma.verificationToken` — not `prisma.authAccount`, `prisma.authSession`, `prisma.authVerificationToken`.

### Finding 2 — Revised naming recommendation

| Model | Use exact Auth.js name? | Rationale |
|---|---|---|
| `Account` | ✅ Yes | No internal conflict; adapter expects this name |
| `VerificationToken` | ✅ Yes | No internal conflict; adapter expects this name |
| Session (Auth.js) | ⏸️ Skip initially | Conflicts with internal `Session`; use JWT strategy |
| `Session` (internal) | ✅ Keep as-is | No rename needed with JWT strategy |

### Finding 3 — JWT session strategy avoids Session conflict

By using Auth.js JWT session strategy (`strategy: "jwt"`), the adapter does not need a database `Session` model at all. This completely avoids the naming conflict with the internal `Session`.

### Finding 4 — UUID IDs work fine

No issues with UUID primary keys. The adapter does not enforce `cuid()`.

### Finding 5 — Prisma 7 compatible at package level

`@auth/prisma-adapter@2.11.2` installs and compiles alongside Prisma 7 without issues.

### Finding 6 — Auth.js v5 is still in beta

The `latest` npm tag for `next-auth` is v4 (4.24.14). Auth.js v5 (which is what authjs.dev documents) is available only under the `beta` tag (5.0.0-beta.31). The project should track the beta channel and evaluate stability before production deployment.

## Revised Schema Recommendation for TASK-0030+

```prisma
// Add to User:
emailVerified DateTime? @map("email_verified")
// Add User relations:
accounts          Account[]

// New model — exact Auth.js name (no prefix):
model Account {
  // ... same fields as proposed AuthAccount ...
  @@map("accounts")
}

// New model — exact Auth.js name (no prefix):
model VerificationToken {
  // ... same fields as proposed AuthVerificationToken ...
  @@map("verification_tokens")
}

// NO Auth.js Session table initially — use JWT strategy
// Internal Session remains unchanged
```

## Explicit Non-Goals

- No production auth implementation
- No production middleware
- No login/signup UI
- No callback routes
- No provider secrets
- No real OAuth provider setup
- No Prisma migration files
- No production env vars

## Retention Policy

Package changes (`package.json`, `pnpm-lock.yaml`), schema changes (`prisma/schema.prisma`), spike source files (`src/spikes/`), and spike tests (`__tests__/spikes/`) were all intentionally **not retained** in the final PR. Only documentation artifacts are merged to `main`.

## Decision

Spike findings accepted; do not retain spike package/schema changes on main. Proceed with exact `Account` and `VerificationToken` naming plus JWT session strategy in the next schema task.

## Recommended Next Task

[Phase 2] TASK-0030: Auth provider persistence migration proposal with Account and VerificationToken
