# TASK-0023: Tenant Audit API Handler Contracts Behind Feature Gate

## Summary
Implements feature-gated tenant audit API handler contracts for listing tenant audit events and reading tenant audit event details.

## Files Created
- `src/app/api/businesses/[businessId]/audit-events/handler.ts`
- `__tests__/api/audit-events-handler.test.ts`
- `docs/checkpoints/TASK-0023-tenant-audit-api-handler-contracts.md`

## Files Modified
- `src/app/api/businesses/[businessId]/audit-events/route.ts`
- `src/app/api/businesses/[businessId]/audit-events/[auditEventId]/route.ts`
- `__tests__/api/api-route-feature-gate.test.ts`
- `__tests__/api/identity-me-handler.test.ts`
- `__tests__/api/tenant-identity-route-skeletons.test.ts`

## Handler Design
Two factory functions: createGetAuditEventsHandler (LIST), createGetAuditEventByIdHandler (GET_BY_ID), plus createAuditEventHandlers combined factory.

## Feature Gate Behavior
| Condition | All audit routes |
|---|---|
| ENABLE_API_HANDLERS missing | 501 NOT_IMPLEMENTED |
| ENABLE_API_HANDLERS=true (no dev auth) | 501 AUTH_CONTEXT_UNAVAILABLE |
| Both enabled + dev headers | Service result |

## Context Behavior
All handlers use tenant request context (x-dev-user-id + x-dev-business-id + x-dev-membership-id + x-dev-role).

## Audit List Behavior
- Scopes list to route businessId
- Supports query filters: actorUserId, action, targetType, targetId, result, actorType, limit
- Validates all query params individually
- Rejects invalid actorUserId (non-uuid), result, actorType, limit (0, 101, non-integer)

## Audit Detail Behavior
- Validates businessId and auditEventId route params
- Finds event by ID
- Returns 404 AUDIT_EVENT_NOT_FOUND if null
- Rejects event from other business with TENANT_ACCESS_DENIED
- Rejects event with null businessId with TENANT_ACCESS_DENIED

## Authorization Behavior
- LIST requires audit.read
- GET_BY_ID requires audit.read

## Route Changes
- audit-events/route.ts: placeholder → feature-gated GET with handler wiring
- audit-events/[auditEventId]/route.ts: placeholder → feature-gated GET with handler wiring

## Tests Added
32 new tests (518 total passing, 7 skipped)

## Checks Run
| Check | Result |
|---|---|
| pnpm typecheck | ✅ |
| pnpm lint | ✅ |
| pnpm test | ✅ 518 passed, 7 skipped |
| pnpm build | ✅ |

## Issues Found
- parseIntegerQueryParam returns undefined not null — fixed during typecheck

## Decision
Accepted tenant audit API handler contracts behind feature gate.

## Recommended Next Task
[Phase 1] TASK-0024: Implement authz API handler contracts behind feature gate

## Scope Confirmation
- ✅ Only tenant audit routes changed
- ✅ Default behavior remains NOT_IMPLEMENTED
- ✅ Enabled behavior returns AUTH_CONTEXT_UNAVAILABLE until dev auth is enabled
- ✅ Dev auth mode can call mocked audit/authz services
- ✅ Service calls occur only after successful context resolution
- ✅ Authz is checked before audit list/detail actions
- ✅ Audit event business ownership is checked before detail response
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
