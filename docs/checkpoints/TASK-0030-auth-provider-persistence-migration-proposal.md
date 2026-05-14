# TASK-0030: Auth Provider Persistence Migration Proposal

## Summary

Documentation-only migration proposal for Auth provider persistence using exact Auth.js-compatible `Account` and `VerificationToken` model names, plus JWT session strategy. Incorporates TASK-0029 spike findings to produce an actionable schema implementation plan.

## Files Created

- `docs/architecture/auth-provider-persistence-migration-proposal.md`
- `docs/checkpoints/TASK-0030-auth-provider-persistence-migration-proposal.md`

## Files Modified

None.

## Proposal Scope

- Proposed `User.emailVerified DateTime?` addition
- Proposed `User.accounts Account[]` relation
- Proposed exact `Account` model (14 fields, mapped to `accounts` table)
- Proposed exact `VerificationToken` model (3 fields, mapped to `verification_tokens` table)
- JWT session strategy — no Auth.js database Session table initially
- Internal `Session` preserved unchanged
- Internal `Business`/`BusinessMembership`/`AuditEvent`/`Authz` preserved unchanged
- Single additive migration step — fully reversible
- Rollback plan documented
- Adapter compatibility alignment verified against TASK-0029 findings

## TASK-0029 Spike Findings Applied

- Prefixed `Auth*` names abandoned — exact `Account` and `VerificationToken` used
- JWT session strategy avoids internal `Session` conflict
- UUID primary keys confirmed compatible
- Prisma 7 compile-level compatible
- Runtime DB compatibility deferred to implementation task

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

Accepted migration proposal: add `emailVerified` to User, create `Account` and `VerificationToken` models using exact Auth.js names, adopt JWT session strategy, preserve internal Session and all tenant/authz models unchanged.

## Recommended Next Task

[Phase 2] TASK-0031: Apply auth provider persistence migration (Account, VerificationToken, emailVerified)

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
