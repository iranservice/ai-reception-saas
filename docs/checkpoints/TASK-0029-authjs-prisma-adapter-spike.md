# TASK-0029: Auth.js Package and Prisma Adapter Spike

## Summary

Spike-only validation of Auth.js package and Prisma Adapter compatibility with the project's Prisma 7 setup, UUID primary keys, required User fields, and proposed schema naming strategy. Final PR is documentation-only.

## Files Created

- `docs/architecture/authjs-prisma-adapter-spike-report.md`
- `docs/checkpoints/TASK-0029-authjs-prisma-adapter-spike.md`

## Files Modified

None.

## Packages Added

None retained in final PR.

Temporary local spike tested `next-auth@5.0.0-beta.31` and `@auth/prisma-adapter@2.11.2`, but package changes were reverted before PR acceptance.

## Schema Spike Summary

Temporary local spike tested `User.emailVerified`, `AuthAccount`, `AuthSession`, and `AuthVerificationToken`, but schema changes were reverted before PR acceptance.

## Spike Source/Test Files

None retained in final PR.

Temporary local spike used spike-only source/test files (`src/spikes/authjs/authjs-spike-config.ts` and `__tests__/spikes/authjs-prisma-adapter-spike.test.ts`), but they were removed before PR acceptance.

## Key Findings

1. **Prefixed model names (AuthAccount, etc.) do NOT work** with the default `PrismaAdapter` — adapter expects `prisma.account`, not `prisma.authAccount`.
2. **Revised recommendation:** Use exact Auth.js names `Account` and `VerificationToken` (no internal conflict).
3. **JWT session strategy** avoids the `Session` naming conflict entirely — no adapter Session table needed.
4. **UUID primary keys** work fine with the adapter.
5. **Prisma 7** is compatible at the package/compilation level.
6. **Auth.js v5** is still beta (`5.0.0-beta.31`); latest npm tag gives v4.
7. **Required User.name/email** compiles but may need runtime fallbacks during OAuth user creation.
8. **Runtime DB compatibility** remains future work.

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

- TASK-0028 `Auth*` prefixed naming strategy is partially incompatible with default `PrismaAdapter`. Revised to use exact Auth.js model names for `Account` and `VerificationToken`.

## Decision

Spike findings accepted; do not retain spike package/schema changes on main. Proceed with exact `Account` and `VerificationToken` naming plus JWT session strategy in the next schema task.

## Recommended Next Task

[Phase 2] TASK-0030: Auth provider persistence migration proposal with Account and VerificationToken

## Scope Confirmation

- ✅ Documentation only in final PR
- ✅ No package changes retained
- ✅ No lockfile changes retained
- ✅ No Prisma schema changes retained
- ✅ No migrations
- ✅ No spike source files retained
- ✅ No spike tests retained
- ✅ No production auth implementation
- ✅ No middleware
- ✅ No auth routes
- ✅ No provider secrets
- ✅ No UI
- ✅ Tenant/authz ownership unchanged
