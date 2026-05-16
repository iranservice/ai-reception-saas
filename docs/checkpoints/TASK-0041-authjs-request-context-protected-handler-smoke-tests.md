# TASK-0041 — Auth.js Request-Context Protected Handler Smoke Tests

| Field | Value |
|---|---|
| Task ID | TASK-0041 |
| Title | Auth.js request-context integration smoke tests for protected API handlers |
| Status | Complete |
| Branch | task-0041-authjs-request-context-protected-handler-smoke-tests |
| Baseline | PR #45 merged (ea933fd) |
| Scope | Tests + documentation only |

## Summary

Adds 15 integration smoke tests proving protected API handlers work correctly with Auth.js-style tenant request-context resolution injected via handler factories. No source code changes.

## Test File

`__tests__/api/authjs-protected-handler-smoke.test.ts`

## Coverage Matrix

| ID | Handler | Scenario | Expected |
|---|---|---|---|
| A1 | GET business by ID | Auth.js session + route param + membership + authz | 200 |
| A2 | PATCH business by ID | Route param canonical, mismatched header ignored | 200 |
| B3 | GET memberships | Auth.js tenant context success | 200 |
| B4 | POST membership | Body validated, service called with businessId | 200 |
| B5 | PATCH membership role | Route param wins, authz checked before service | 200 |
| C6 | GET audit events | Auth.js tenant + authz audit.read | 200 |
| C7 | GET audit event by ID | Event belongs to business | 200 |
| D8 | POST authz/evaluate | x-business-id header fallback (no route param) | 200 |
| D9 | POST authz/require | Denied result returns ok (not error) | 200 |
| E10 | GET business (no session) | UNAUTHENTICATED | 401 |
| E11 | GET business (empty user.id) | INVALID_AUTH_CONTEXT | 400 |
| E12 | GET memberships (mismatch header) | Route param wins | 200 |
| E13 | Resolver (blank route-param) | TENANT_CONTEXT_REQUIRED | 403 |
| E14 | POST authz/evaluate (no header) | TENANT_CONTEXT_REQUIRED | 403 |
| E15 | GET audit events (denied membership) | ACCESS_DENIED, no service call | 403 |

## Test Design

Tests use a `createAuthjsTenantResolver()` helper that simulates the Auth.js adapter behavior:

- Route-param scope isolation (never falls back to header)
- Header fallback for generic routes
- Session null → UNAUTHENTICATED 401
- Empty user.id → INVALID_AUTH_CONTEXT 400
- Membership denied → ACCESS_DENIED 403

Handlers are exercised through their factory functions with injected mock services and the simulated Auth.js resolver. This tests the handler → context resolution → authz → service pipeline without requiring the Next.js runtime.

## Files Changed

| File | Change |
|---|---|
| `__tests__/api/authjs-protected-handler-smoke.test.ts` | [NEW] 15 smoke tests |
| `docs/checkpoints/TASK-0041-authjs-request-context-protected-handler-smoke-tests.md` | [NEW] Checkpoint |

## Files Not Changed

- package.json / pnpm-lock.yaml
- prisma/schema.prisma / prisma/migrations/*
- env files
- middleware
- UI
- Source code (no runtime changes)
- domain services / repository layer
- authz policy

## Checks Run

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ (0 errors, 10 warnings) |
| `pnpm test` | ✅ 844 passed, 7 skipped |
| `pnpm build` | ✅ |

## Decision

Accepted Auth.js request-context protected handler smoke tests; no runtime changes, test-only task.

## Recommended Next Task

[Phase 3] TASK-0042: Implement Auth.js system request-context resolver with API key or service token validation.
