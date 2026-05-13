# TASK-0024: Authz API Handler Contracts Behind Feature Gate

## Summary
Implements feature-gated authz API handler contracts for evaluating access, requiring permission, and listing role permissions.

## Files Created
- `src/app/api/authz/handler.ts`
- `__tests__/api/authz-handler.test.ts`
- `docs/checkpoints/TASK-0024-authz-api-handler-contracts.md`

## Files Modified
- `src/app/api/authz/evaluate/route.ts`
- `src/app/api/authz/require/route.ts`
- `src/app/api/authz/roles/[role]/permissions/route.ts`
- `__tests__/api/api-route-feature-gate.test.ts`
- `__tests__/api/identity-me-handler.test.ts`
- `__tests__/api/identity-sessions-handler.test.ts`
- `__tests__/api/businesses-handler.test.ts`
- `__tests__/api/business-memberships-handler.test.ts`
- `__tests__/api/audit-events-handler.test.ts`
- `__tests__/api/tenant-identity-route-skeletons.test.ts`
- `__tests__/api/api-composition-root.test.ts`

## Handler Design
Three factory functions: createPostAuthzEvaluateHandler (EVALUATE), createPostAuthzRequireHandler (REQUIRE), createGetRolePermissionsHandler (ROLE_PERMISSIONS), plus createAuthzApiHandlers combined factory.

## Feature Gate Behavior
| Condition | All authz routes |
|---|---|
| ENABLE_API_HANDLERS missing | 501 NOT_IMPLEMENTED |
| ENABLE_API_HANDLERS=true (no dev auth) | 501 AUTH_CONTEXT_UNAVAILABLE |
| Both enabled + dev headers | Service result |

## Context Behavior
- Evaluate/require: tenant context (x-dev-user-id + x-dev-business-id + x-dev-membership-id + x-dev-role)
- Role permissions: authenticated context (x-dev-user-id only)

## Evaluate Behavior
- Validates body permission using strict schema
- Uses tenant context userId/businessId/role (never body values)
- Calls evaluateAccess with context values + body permission

## Require Behavior
- Validates body permission using strict schema
- Uses tenant context userId/businessId/role (never body values)
- Calls requirePermission with context values + body permission
- Returns denied decision as-is from service (200 with allowed:false)

## Role Permissions Behavior
- Validates role route param using membershipRoleSchema
- Requires authenticated context (not tenant)
- Calls listRolePermissions with validated role

## Route Changes
- authz/evaluate/route.ts: placeholder → feature-gated POST with handler wiring
- authz/require/route.ts: placeholder → feature-gated POST with handler wiring
- authz/roles/[role]/permissions/route.ts: placeholder → feature-gated GET with handler wiring

## Tests Added
28 new tests (540 total passing, 7 skipped)

## Checks Run
| Check | Result |
|---|---|
| pnpm typecheck | ✅ |
| pnpm lint | ✅ |
| pnpm test | ✅ 540 passed, 7 skipped |
| pnpm build | ✅ |

## Issues Found
- makeJsonRequest takes (body, init) not (url, body, headers) — fixed during typecheck
- roles/[role]/permissions import path needed 3 levels up — fixed during typecheck
- Multiple existing scope guard tests referenced authz/evaluate as placeholder — all updated

## Decision
Accepted authz API handler contracts behind feature gate

## Recommended Next Task
[Phase 1] TASK-0025: API handler baseline acceptance checkpoint

## Scope Confirmation
- ✅ Only authz routes changed
- ✅ Default behavior remains NOT_IMPLEMENTED
- ✅ Enabled behavior returns AUTH_CONTEXT_UNAVAILABLE until dev auth is enabled
- ✅ Dev auth mode can call mocked authz services
- ✅ Service calls occur only after successful context resolution
- ✅ Evaluate/require use context userId/businessId/role, not client body values
- ✅ Role permissions require authenticated context
- ✅ No service calls when feature gate disabled
- ✅ No getApiDependencies call when feature gate disabled
- ✅ No getPrisma usage in route or handler files
- ✅ No PrismaClient usage in route or handler files
- ✅ No middleware
- ✅ No real authentication
- ✅ No token verification
- ✅ No session cookie parsing
- ✅ No auth provider integration
- ✅ No UI
- ✅ No Prisma schema changes
- ✅ No migrations
- ✅ No new Prisma models
- ✅ No provider SDKs
- ✅ No Supabase
- ✅ No contracts scaffold
- ✅ No domain renames
