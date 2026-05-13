# TASK-0025: API Handler Baseline Acceptance Checkpoint

## Summary

This checkpoint accepts the API handler baseline after TASK-0018 through TASK-0024. The baseline establishes the complete API handler contract layer for identity, session, business workspace, membership, audit, and authz operations. All handlers remain behind the `ENABLE_API_HANDLERS` feature gate and use a dev/test auth context adapter rather than production authentication. This baseline is suitable for development and testing contract verification but is not production-authenticated.

## Repository State

| Field | Value |
|---|---|
| Base branch | main |
| Baseline commit | `41dc3f6edf1ffe3857737363f9694b87a4122403` |
| Checkpoint branch | `task-0025-api-handler-baseline-acceptance-checkpoint` |
| Checkpoint type | Documentation-only |

## Accepted Task Range

| Task | Scope | Accepted Capability |
|---|---|---|
| TASK-0018 | Identity self-profile | GET/PATCH /api/identity/me behind feature gate |
| TASK-0019 | Request context adapter | Dev/test auth context resolver adapter |
| TASK-0020 | Identity sessions | POST/GET sessions and revoke behind feature gate |
| TASK-0021 | Business workspaces | POST/GET business and GET/PATCH business by id behind feature gate |
| TASK-0022 | Business memberships | list/create/update-role/update-status/delete behind feature gate |
| TASK-0023 | Tenant audit | audit list/detail behind feature gate |
| TASK-0024 | Authz | evaluate/require/role permissions behind feature gate |

## API Surface Inventory

### Identity

- `GET /api/identity/me` — self-profile read
- `PATCH /api/identity/me` — self-profile update
- `POST /api/identity/sessions` — session creation
- `GET /api/identity/sessions` — session list
- `POST /api/identity/sessions/:sessionId/revoke` — session revocation

### Business Workspaces

- `POST /api/businesses` — business creation
- `GET /api/businesses` — business list
- `GET /api/businesses/:businessId` — business read by id
- `PATCH /api/businesses/:businessId` — business update by id

### Business Memberships

- `GET /api/businesses/:businessId/memberships` — membership list
- `POST /api/businesses/:businessId/memberships` — membership creation
- `PATCH /api/businesses/:businessId/memberships/:membershipId/role` — role update
- `PATCH /api/businesses/:businessId/memberships/:membershipId/status` — status update
- `DELETE /api/businesses/:businessId/memberships/:membershipId` — membership removal

### Tenant Audit

- `GET /api/businesses/:businessId/audit-events` — audit event list with filters
- `GET /api/businesses/:businessId/audit-events/:auditEventId` — audit event detail

### Authz

- `POST /api/authz/evaluate` — access evaluation
- `POST /api/authz/require` — permission requirement check
- `GET /api/authz/roles/:role/permissions` — role permission list

**Total accepted endpoints: 21**

## Feature Gate Contract

- `ENABLE_API_HANDLERS` must be exactly `"true"` for implemented handlers to run.
- When disabled (missing or any value other than `"true"`), all implemented routes return `501 NOT_IMPLEMENTED`.
- `getApiDependencies` must only be called after `ENABLE_API_HANDLERS` is confirmed enabled.
- No route should initialize services at module import time.
- No route should call `getApiDependencies` at module scope.

## Dev Auth Context Contract

- `ENABLE_DEV_AUTH_CONTEXT` must be exactly `"true"` for dev/test auth context resolution.
- Dev/test headers are only trusted when `ENABLE_DEV_AUTH_CONTEXT` is exactly `"true"`.
- Without dev auth enabled, enabled handlers return `501 AUTH_CONTEXT_UNAVAILABLE`.
- This is **not** real authentication.
- This is **not** token verification.
- This is **not** session cookie parsing.
- This is **not** middleware.

### Dev Headers

| Header | Purpose |
|---|---|
| `x-dev-user-id` | Authenticated user identity (UUID) |
| `x-dev-business-id` | Tenant business scope (UUID) |
| `x-dev-membership-id` | Membership identity (UUID) |
| `x-dev-role` | Membership role (OWNER/ADMIN/OPERATOR/VIEWER) |
| `x-dev-system` | System-level context flag |

## Handler Architecture

The accepted handler architecture follows these principles:

1. **`route.ts`** owns the feature gate check and lazy composition access via `getApiDependencies`.
2. **`handler.ts`** owns request validation, context resolution, authorization checks, and service delegation.
3. Domain services are dependency-injected into handlers via the `*HandlerDeps` interface pattern.
4. Tests mock `@/app/api/_shared/composition` to avoid Prisma/DATABASE_URL initialization.
5. No handler calls `getApiDependencies` directly — that responsibility belongs to the route layer.
6. No handler calls `getPrisma` or `PrismaClient`.
7. No route calls `getApiDependencies` when the feature gate is disabled.

### Handler Module Files

| Module | File |
|---|---|
| Identity self-profile | `src/app/api/identity/me/handler.ts` |
| Identity sessions | `src/app/api/identity/sessions/handler.ts` |
| Business workspaces | `src/app/api/businesses/handler.ts` |
| Business memberships | `src/app/api/businesses/[businessId]/memberships/handler.ts` |
| Tenant audit | `src/app/api/businesses/[businessId]/audit-events/handler.ts` |
| Authz | `src/app/api/authz/handler.ts` |

## Trust Boundary Rules

- Request body must **not** provide trusted `userId`, `businessId`, or `role` values.
- Context `userId` is used for identity/session actions.
- Tenant context `businessId`/`role` is used for tenant-scoped actions.
- Route `businessId` must match tenant context `businessId` (enforced in handler).
- Authz checks happen before protected tenant read/write actions.
- Ownership/business membership checks happen before mutation where applicable.
- Audit event business ownership is verified before detail response.
- Authz evaluate/require use tenant context actor fields, never client body values.

## Authorization Rules Accepted

| Action | Authorization Requirement |
|---|---|
| Business read/update by id | Authz check required |
| Membership list/create/update/delete | Authz check required (permission varies by action) |
| Tenant audit list/detail | `audit.read` permission required |
| Authz evaluate/require | Tenant context required; body provides only `permission` |
| Role permissions | Authenticated context required (not tenant) |
| Identity self-profile | Authenticated context ownership (self only) |
| Identity sessions | Authenticated context ownership (self only) |

## Remaining Placeholder Routes

Only one route remains placeholder-only:

- `src/app/api/identity/users/[userId]/route.ts` — still uses `createPlaceholderRoute`

All other routes have been wired to real handler modules behind the feature gate.

## Scope Confirmation

- ✅ No real authentication
- ✅ No auth provider integration
- ✅ No middleware
- ✅ No token verification
- ✅ No session cookie parsing
- ✅ No UI
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No new Prisma models
- ✅ No provider SDKs
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames
- ✅ No package changes
- ✅ No lockfile changes
- ✅ No environment variable changes
- ✅ No GitHub workflow changes
- ✅ No integration test changes

## Verification Commands

| Check | Result |
|---|---|
| `pnpm install` | ✅ |
| `pnpm prisma:format` | ✅ |
| `pnpm prisma:generate` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ passed with 3 warnings (0 errors) |
| `pnpm test` | ✅ 540 passed, 7 skipped |
| `pnpm build` | ✅ |

## Test Baseline

| Metric | Value |
|---|---|
| Test files passed | 20 |
| Test files skipped | 1 |
| Tests passed | 540 |
| Tests skipped | 7 |

The skipped test file is `__tests__/integration/tenant-identity-repositories.integration.test.ts` (7 tests). Normal integration tests remain skipped unless `RUN_INTEGRATION_TESTS=true`.

## File Change Confirmation

This PR adds only:

- `docs/checkpoints/TASK-0025-api-handler-baseline-acceptance-checkpoint.md`

No other files are changed.

## Risks / Notes

- Feature-gated handler baseline is suitable for development/testing contract verification.
- It is **not** production-authenticated.
- Real auth provider integration remains future work.
- API handlers use service interfaces and mocked dependencies in tests.
- Runtime DB-backed behavior depends on future auth/session/middleware integration and deployment configuration.
- The single remaining placeholder route (`identity/users/[userId]`) will be wired when the admin user management scope is addressed.

## Decision

Accepted API handler baseline checkpoint

## Recommended Next Task

[Phase 2] TASK-0026: API runtime authentication strategy and provider decision record
