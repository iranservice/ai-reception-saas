# TASK-0033: Runtime Auth.js Configuration Behind Feature Flag

## Summary

Added isolated runtime Auth.js configuration primitives gated behind a feature flag (`ENABLE_AUTHJS_RUNTIME`). The configuration factory validates secrets, normalizes providers, enforces JWT session strategy, and integrates with the TASK-0032 adapter wrapper. No Auth.js route handlers, middleware, or provider secrets are wired.

## Files Created

- `src/lib/auth/authjs-feature-gate.ts` — feature flag utility with guard assertion and typed error
- `src/lib/auth/authjs-runtime-config.ts` — config factory with secret/provider validation
- `__tests__/auth/authjs-runtime-config.test.ts` — 51 tests covering feature gate, validation, config factory, and scope guards
- `docs/checkpoints/TASK-0033-runtime-authjs-configuration-feature-flag.md` — this file

## Files Modified

- `src/lib/auth/index.ts` — added feature gate and runtime config re-exports

## Feature Gate

- Environment variable: `ENABLE_AUTHJS_RUNTIME`
- Accepts `'true'` or `'1'` (case-insensitive)
- All other values (including undefined) return `false`
- `isAuthjsRuntimeEnabled()` — non-throwing check
- `assertAuthjsRuntimeEnabled(operation)` — throws `AuthjsRuntimeDisabledError` when disabled
- Feature gate is read at call time, not import time

## Runtime Config

- `createAuthjsConfig(input)` — creates validated config, throws if disabled or secret missing
- `tryCreateAuthjsConfig(input)` — returns null if disabled, throws only on invalid secret
- JWT session strategy is always enforced (`session.strategy = 'jwt'`)
- Adapter is passed through from TASK-0032 adapter wrapper
- Provider list is validated but empty by default
- Secret validation rejects null/undefined/empty/whitespace-only values
- Base URL and debug mode are optional

## Provider Validation

- `normalizeProviderDescriptor(provider)` — extracts id/name/type from opaque provider config
- Accepts types: `oauth`, `oidc`, `email`, `credentials`
- Returns null for invalid/unrecognizable providers
- `validateProviders(providers)` — filters array to valid descriptors

## Runtime Scope

- No route wiring
- No middleware
- No callback route
- No provider secrets
- No `.env` or `.env.example` changes
- No login/signup UI
- No request-context resolver changes
- No existing API route changes

## Tests Added (51 tests)

### Feature gate tests (13 tests)

- Feature flag constant equals `ENABLE_AUTHJS_RUNTIME`
- Returns false for: undefined, empty, "false", "0", arbitrary string
- Returns true for: "true", "TRUE", "True" with whitespace, "1"
- Assert throws `AuthjsRuntimeDisabledError` when disabled
- Assert includes operation name and flag name in error
- Assert does not throw when enabled

### Secret validation tests (5 tests)

- Returns trimmed secret for valid input
- Throws for undefined, null, empty, whitespace-only

### Provider normalization tests (15 tests)

- Normalizes oauth, oidc, email, credentials providers
- Uses id as name when name is missing
- Returns null for: null, non-object, missing id, missing type, invalid type
- Validates provider arrays and filters invalids
- Returns empty array for empty input

### Config factory tests (9 tests)

- Throws `AuthjsRuntimeDisabledError` when flag is off
- Throws on missing secret even when enabled
- Creates valid config with all fields
- Enforces JWT strategy
- Defaults debug to false
- Passes through providers

### tryCreateAuthjsConfig tests (3 tests)

- Returns null when disabled (does not throw)
- Returns config when enabled
- Throws on invalid secret even when enabled

### Scope guard tests (6 tests)

- `src/app/**` does not import feature gate or runtime config
- `src/domains/**` does not import feature gate or runtime config
- No middleware.ts added
- No auth route handlers added
- No schema changes
- No migration files added
- No `.env` changes with `ENABLE_AUTHJS_RUNTIME`
- Runtime config does not import getPrisma or PrismaClient
- Feature gate does not import next-auth

## Checks Run

| Check | Result |
|---|---|
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 4 warnings) |
| `pnpm test` | ✅ 672 passed, 7 skipped |
| `pnpm build` | ✅ |

## Issues Found

None.

## Decision

Accepted Auth.js runtime configuration primitives behind feature flag: config factory validated, JWT strategy enforced, adapter integrated, and route wiring deferred.

## Recommended Next Task

TASK-0034: Wire Auth.js route handler behind feature flag

## Scope Confirmation

- ✅ Feature gate only
- ✅ Config factory only
- ✅ No production auth route wiring
- ✅ No middleware
- ✅ No callback route
- ✅ No provider secrets
- ✅ No .env or .env.example changes
- ✅ No UI
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No domain service changes
- ✅ No tenant/authz changes
- ✅ No request-context resolver changes
- ✅ No existing API route changes
- ✅ Internal Session unchanged
