# TASK-0027: Auth.js Compatibility Review and Auth Schema Integration Design

## Summary

Documentation-only Auth.js compatibility review and schema integration design. Reviews current internal Prisma schema against Auth.js Prisma Adapter expectations, identifies compatibility gaps, evaluates integration options, and recommends a future schema direction.

## Files Created

- `docs/architecture/authjs-compatibility-review.md`
- `docs/checkpoints/TASK-0027-authjs-compatibility-review-schema-design.md`

## Files Modified

None.

## Research Scope

- Current repo Prisma schema reviewed (`prisma/schema.prisma`)
- Package baseline reviewed (`package.json` — Next.js 15.5.16, Prisma ^7, @prisma/adapter-pg ^7.8.0)
- Auth.js Prisma Adapter official docs reviewed ([authjs.dev/getting-started/adapters/prisma](https://authjs.dev/getting-started/adapters/prisma))
- Auth.js Next.js installation docs reviewed ([authjs.dev/getting-started/installation](https://authjs.dev/getting-started/installation?framework=next.js))
- Auth.js WebAuthn docs reviewed ([authjs.dev/getting-started/authentication/webauthn](https://authjs.dev/getting-started/authentication/webauthn))
- Official schema examples verified including snake_case naming convention variant

## Current Schema Findings

- **User:** Partially compatible. Missing `emailVerified` field. `name` is required (Auth.js expects optional). `avatarUrl` naming differs from Auth.js `image`.
- **Session:** Not automatically compatible. Internal `tokenHash`-based semantics differ fundamentally from Auth.js `sessionToken`-based model.
- **Account:** Missing. Required for OAuth/provider account linking.
- **VerificationToken:** Missing. Required for email/magic-link verification flows.
- **Authenticator:** Missing but optional (WebAuthn experimental). Deferred.
- **BusinessMembership:** Must remain internal. No Auth.js conflict.
- **Authz:** Must remain internal. No Auth.js conflict.
- **AuditEvent:** Can later record normalized auth events. No conflict.

## Recommended Integration Direction

Reuse internal User as canonical application user; add separate Auth.js-compatible provider account/session/token persistence models in future schema task; preserve internal BusinessMembership/Authz ownership.

Recommended option: **Option B** — Reuse User, add Auth.js-specific Account/Session/VerificationToken tables alongside existing internal Session.

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

Accepted Auth.js compatibility review and schema integration direction.

## Recommended Next Task

[Phase 2] TASK-0028: Auth.js schema design and migration proposal

## Scope Confirmation

- ✅ Documentation only
- ✅ No Auth.js installation
- ✅ No @auth/prisma-adapter installation
- ✅ No provider SDK installation
- ✅ No route changes
- ✅ No handler changes
- ✅ No shared utility changes
- ✅ No domain changes
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No tests changed
- ✅ No package changes
- ✅ No lockfile changes
- ✅ No env changes
- ✅ No workflow changes
- ✅ No UI
- ✅ No middleware
- ✅ No real authentication
