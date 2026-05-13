# TASK-0028: Auth.js Schema Design and Migration Proposal

## Summary

Documentation-only Auth.js schema design and migration proposal. Turns the TASK-0027 compatibility review into a concrete schema proposal with exact model definitions, naming strategy, migration order, rollback plan, and adapter compatibility validation requirements.

## Files Created

- `docs/architecture/authjs-schema-design.md`
- `docs/checkpoints/TASK-0028-authjs-schema-design-migration-proposal.md`

## Files Modified

None.

## Design Scope

- Proposed exact Prisma model snippets for `AuthAccount`, `AuthSession`, `AuthVerificationToken`
- Proposed `emailVerified` addition to existing `User` model
- Deferred `AuthAuthenticator` model for WebAuthn/passkeys
- Named models with `Auth*` prefix to avoid collision with internal `Session`
- Mapped tables to `auth_*` snake_case convention
- Documented migration order (Phase 1: additive-only, Phase 2: deferred)
- Documented rollback plan (fully reversible)
- Documented adapter compatibility validation requirements for TASK-0029 spike
- Documented session strategy options (database vs. JWT, recommending database first)

## Current Schema Findings

- `User` partially compatible — missing `emailVerified`, `name` required (Auth.js expects optional)
- Internal `Session` must not be reused — different semantics (hashed token vs. plain token)
- `Account` model missing — required for provider account linking
- `VerificationToken` model missing — required for email/magic-link flows
- `BusinessMembership`/`Authz` remain internal and untouched

## Proposed Schema Changes (not applied)

| Change | Type | Notes |
|---|---|---|
| `User.emailVerified` | Add field | `DateTime? @map("email_verified")` |
| `User.authAccounts` | Add relation | `AuthAccount[]` |
| `User.authSessions` | Add relation | `AuthSession[]` |
| `AuthAccount` | New model | 13 fields, provider account linking |
| `AuthSession` | New model | 6 fields, Auth.js database sessions |
| `AuthVerificationToken` | New model | 3 fields, email/magic-link tokens |
| `AuthAuthenticator` | Deferred | WebAuthn/passkeys only |

## Adapter Compatibility Risks

1. Prefixed model names may require custom adapter wrapper
2. UUID primary keys differ from Auth.js default `cuid()`
3. Required `User.name`/`User.email` differs from Auth.js optional
4. Prisma 7 compatibility with `@auth/prisma-adapter` is unverified
5. `prisma.config.ts` pattern may need adapter adjustment

All risks assigned to TASK-0029 spike for validation.

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 3 warnings) |
| `pnpm test` | ✅ 540 passed, 7 skipped |
| `pnpm build` | ✅ |

## Issues Found

None.

## Decision

Accepted schema design proposal: add `emailVerified` to User, create `AuthAccount`, `AuthSession`, and `AuthVerificationToken` models with prefixed names mapping to `auth_*` tables, preserving existing internal Session and all tenant/authz models unchanged.

## Recommended Next Task

[Phase 2] TASK-0029: Auth.js package and provider spike in isolated branch

## Scope Confirmation

- ✅ Documentation only
- ✅ No Prisma schema changes
- ✅ No migration files created
- ✅ No Auth.js installation
- ✅ No @auth/prisma-adapter installation
- ✅ No next-auth installation
- ✅ No provider SDK installation
- ✅ No route changes
- ✅ No handler changes
- ✅ No shared utility changes
- ✅ No domain changes
- ✅ No tests changed
- ✅ No package changes
- ✅ No lockfile changes
- ✅ No env changes
- ✅ No workflow changes
- ✅ No UI
- ✅ No middleware
- ✅ No real authentication
