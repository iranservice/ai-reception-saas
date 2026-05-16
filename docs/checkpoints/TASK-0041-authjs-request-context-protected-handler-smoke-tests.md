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

Adds 15 integration smoke tests proving protected API handlers work correctly with the **real** Auth.js request-context adapter (`createAuthjsRequestContextAdapter`). Tests inject a real adapter instance — with mocked `AuthjsSessionReader` and `TenantMembershipResolver` — into handler factories, exercising the full pipeline: feature-flag gates → session read → scope resolution → businessId normalization → membership lookup → error mapping → handler logic. No source code changes.

## Test File

`__tests__/api/authjs-protected-handler-smoke.test.ts`

## Test Design

Tests use `createRealAdapter()` which calls the real `createAuthjsRequestContextAdapter` factory with:

- `auth: AuthjsSessionReader` — mock function returning session or null
- `tenantMembershipResolver: TenantMembershipResolver` — mock function returning `ActionResult<TenantContext>`
- `env` — both `ENABLE_AUTHJS_REQUEST_CONTEXT` and `ENABLE_AUTHJS_RUNTIME` set to `'true'`

The real adapter's `resolveTenant(request, scope?)` and `resolveAuthenticated(request)` are injected into handler factories via `tenantResolverFromAdapter()` / `authResolverFromAdapter()` wrappers. This ensures all adapter logic (flag gates, scope priority, normalization, error mapping) is exercised — not simulated.

## Coverage Matrix

| ID | Handler | Scenario | Expected |
|---|---|---|---|
| A1 | GET business by ID | Real adapter + session + membership + authz | 200 |
| A2 | PATCH business by ID | Route param canonical, mismatched header ignored by real adapter | 200 |
| B3 | GET memberships | Real adapter tenant context success | 200 |
| B4 | POST membership | Body validated, service called with correct businessId | 200 |
| B5 | PATCH membership role | Route param wins in real adapter, authz before service | 200 |
| C6 | GET audit events | Real adapter tenant + authz audit.read | 200 |
| C7 | GET audit event by ID | Event belongs to business via real adapter | 200 |
| D8 | POST authz/evaluate | x-business-id header fallback in real adapter (no route param) | 200 |
| D9 | POST authz/require | Denied result returns ok (decision, not error) | 200 |
| E10 | GET business (null session) | Real adapter → UNAUTHENTICATED | 401 |
| E11 | GET business (empty user.id) | Real adapter → INVALID_AUTH_CONTEXT | 400 |
| E12 | GET memberships (mismatched header) | Real adapter uses route param, not header | 200 |
| E13 | Real adapter (blank route-param) | Route-param isolation → TENANT_CONTEXT_REQUIRED | 403 |
| E14 | POST authz/evaluate (no header) | Real adapter → TENANT_CONTEXT_REQUIRED | 403 |
| E15 | GET audit events (denied membership) | Real adapter → ACCESS_DENIED, no service call | 403 |

## Files Changed

| File | Change |
|---|---|
| `__tests__/api/authjs-protected-handler-smoke.test.ts` | [NEW] 15 smoke tests using real adapter |
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

Accepted Auth.js request-context smoke coverage for protected API handlers; runtime behavior, middleware, UI, and production rollout remain unchanged.

## Recommended Next Task

[Phase 2] TASK-0042: Auth.js request-context staging rollout checklist and observability plan
