# TASK-0030B: Auth.js User Adapter Contract Decision

## Summary

Documentation-only architecture decision to close the Auth.js User adapter contract risk before applying the auth provider persistence schema migration. Defines how provider user data maps into the existing internal `User` model, establishes fallback policies, and selects the thin adapter wrapper direction.

## Files Created

- `docs/architecture/authjs-user-adapter-contract.md`
- `docs/checkpoints/TASK-0030B-authjs-user-adapter-contract-decision.md`

## Files Modified

None.

## Decision

Accepted User adapter contract: preserve internal User shape, map provider image to avatarUrl, keep name/email required, add only emailVerified in the first schema migration, and require a thin adapter wrapper before runtime Auth.js goes live.

## Architecture Debt Closed

- `avatarUrl` vs `image` mapping decision closed — provider `image` maps to `avatarUrl`; no `image` field added.
- Required `name` fallback policy closed — provider display name → email local-part → `"User"` placeholder.
- Required `email` policy closed — missing email is a hard failure for initial rollout.
- Default PrismaAdapter direct-use risk acknowledged — Option B rejected; thin wrapper required.
- Thin adapter wrapper direction accepted — Option C selected; normalizes data at boundary.
- TASK-0031 schema scope clarified — only `emailVerified`, `Account`, `VerificationToken`; no `image`, no nullable name/email.

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

## Recommended Next Task

[Phase 2] TASK-0031: Apply auth provider persistence migration (Account, VerificationToken, emailVerified)

## Scope Confirmation

- ✅ Documentation only
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No package changes
- ✅ No lockfile changes
- ✅ No Auth.js installation
- ✅ No @auth/prisma-adapter installation
- ✅ No route changes
- ✅ No handler changes
- ✅ No shared utility changes
- ✅ No domain changes
- ✅ No tests changed
- ✅ No env changes
- ✅ No workflow changes
- ✅ No UI
- ✅ No middleware
- ✅ No real authentication
