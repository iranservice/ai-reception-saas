# TASK-0032: Auth.js Package Installation and Adapter Wrapper Implementation

## Summary

Installed Auth.js packages and added an isolated adapter wrapper boundary without wiring runtime auth. The adapter preserves the internal User contract, maps provider `image` to `avatarUrl`, enforces required email/name, and disables database session methods for JWT strategy.

## Files Created

- `src/lib/auth/authjs-adapter.ts` — adapter factory with injected DB interface
- `src/lib/auth/authjs-user-mapping.ts` — pure mapping functions for email, name, image normalization
- `src/lib/auth/index.ts` — barrel re-export
- `__tests__/auth/authjs-user-mapping.test.ts` — 28 user mapping tests
- `__tests__/auth/authjs-adapter.test.ts` — 28 adapter behavior, isolation, and scope guard tests
- `docs/checkpoints/TASK-0032-authjs-package-installation-adapter-wrapper.md` — this file

## Files Modified

- `package.json` — added `next-auth` and `@auth/prisma-adapter` dependencies
- `pnpm-lock.yaml` — lockfile updated

## Packages Added

- `next-auth@5.0.0-beta.31`
- `@auth/prisma-adapter@^2.11.2`

## Adapter Contract Implemented

- Internal User remains canonical — no schema changes
- Provider `image` maps to internal `avatarUrl` via `normalizeAuthjsImage`
- Name fallback implemented: provider name → email local-part → "User"
- Missing email rejected with `AuthjsMappingError`
- Account maps through `provider` + `providerAccountId` composite unique key
- Account token fields (snake_case and camelCase) mapped to Prisma camelCase fields
- VerificationToken supported via create/use (delete-on-use) pattern
- Database sessions disabled — session methods omitted from adapter (Adapter interface declares them optional)
- Internal Session not used by adapter
- DB interface injected — adapter does not import `getPrisma()` or instantiate `PrismaClient`

## Runtime Scope

- No route wiring
- No middleware
- No callback route
- No provider config
- No secrets
- No login/signup UI
- No request-context changes

## Tests Added

### User mapping tests (28 tests)

- Email normalization: lowercase, trim, reject null/undefined/empty/non-string
- Name resolution: provider name, email local-part fallback, "User" fallback
- Image normalization: string passthrough, null for missing/empty/non-string
- Internal→adapter mapping: avatarUrl→image, emailVerified
- Create input: required email, name fallback, image→avatarUrl, no id pass-through, no status/role/tenant
- Update input: image→avatarUrl, name update, null handling, no status/role/tenant

### Adapter behavior tests (28 tests)

- createUser writes normalized data
- getUser returns adapter shape
- getUserByEmail normalizes lookup
- updateUser maps image→avatarUrl
- linkAccount maps snake_case token fields
- getUserByAccount returns linked user
- unlinkAccount deletes by composite key
- createVerificationToken creates row
- useVerificationToken deletes and returns, null on not-found
- Database session methods omitted
- createUnsupportedDatabaseSessionMethod throws correct message
- Module isolation: no getPrisma, no PrismaClient import, no route imports
- Scope guards: no next-auth in app/domains, no middleware, no auth routes, no schema changes, no migrations

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 3 warnings) |
| `pnpm test` | ✅ 618 passed, 7 skipped |
| `pnpm build` | ✅ |

## Issues Found

None.

## Decision

Accepted Auth.js adapter wrapper boundary: packages installed, user mapping isolated, database sessions disabled, and runtime route integration deferred.

## Recommended Next Task

[Phase 2] TASK-0033: Runtime Auth.js configuration behind feature flag

## Scope Confirmation

- ✅ Package installation only
- ✅ Adapter wrapper only
- ✅ No production auth route wiring
- ✅ No middleware
- ✅ No callback route
- ✅ No provider secrets
- ✅ No UI
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No domain service changes
- ✅ No tenant/authz changes
- ✅ Internal Session unchanged
- ✅ User.name remains required
- ✅ User.email remains required
- ✅ User.image not added
